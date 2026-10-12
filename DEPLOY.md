# Despliegue y activación de servicios

La app funciona en **modo protegido**: sin las credenciales de un servicio, esa
integración se salta sin romper el flujo. Al pegar cada credencial en Vercel
(Project → Settings → Environment Variables) y redeployar, se activa sola.

## 1. Base de datos (Supabase) — ya aplicada

Las migraciones de `supabase/migrations/` ya están en el proyecto hosted
(`supabase db push`). Para un entorno nuevo:

```bash
npx supabase link --project-ref <REF>
npx supabase db push
```

Las migraciones crean también el bucket de Storage `media` (avatares del staff
e imágenes de servicio) con sus políticas. Si `db push` se queja con
`must be owner of table objects` al crear las políticas de `storage.objects`,
créalas una vez desde Studio → Storage → Policies copiando el SQL de
`supabase/migrations/20260915150000_media_storage.sql`; el resto de la
migración sí se aplica.

### Comprobación rápida tras desplegar

```bash
./qa/run.sh          # suite end-to-end contra el Supabase real
```

Necesita `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Cada script crea
sus propios negocios con slug `qa-…` y los borra al terminar.

## 2. Variables de entorno en Vercel

| Variable | Necesaria para | Dónde se obtiene |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | siempre | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | siempre | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | siempre (server) | idem (secreto) |
| `NEXT_PUBLIC_APP_URL` | siempre | `https://reservaprimero.com` (sin `www`; la barra final se ignora) |
| `CRON_SECRET` | recordatorios | genera uno aleatorio (`openssl rand -hex 32`) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | email | Resend → API Keys + dominio verificado |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | Meta Business Manager (ver §6) |
| `WHATSAPP_TEMPLATE_LANG` | WhatsApp (opcional) | idioma de las plantillas, por defecto `es` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | anti-bot | Cloudflare → Turnstile |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pagos | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | pagos | Stripe → Webhooks (ver §4) |

## 3. Supabase Auth (para invitaciones de staff y confirmación de correo)

- **URL Configuration → Site URL**: `https://reservaprimero.com`. Es lo que
  pone `{{ .SiteURL }}` en los enlaces de los correos de abajo.
- **URL Configuration → Redirect URLs**: añade
  `http://localhost:3000/**` y `https://reservaprimero.com/**`.
- **Email Templates**: cambia el enlace de estas tres plantillas para que
  apunte a `/auth/confirm` con `token_hash`. El de por defecto
  (`{{ .ConfirmationURL }}`) usa PKCE y sólo funciona si el correo se abre en
  el mismo navegador donde se pidió; abierto desde el móvil, falla.

  | Plantilla | Enlace |
  |---|---|
  | *Invite user* | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/definir-clave` |
  | *Confirm signup* | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding` |
  | *Reset password* | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/definir-clave` |
- **SMTP Settings**: configura un SMTP propio; el de Supabase por defecto solo
  sirve para pruebas (pocos correos/hora).

## 4. Stripe

1. Crea un **producto "Premium"** con un **precio recurrente mensual**.
2. Pega el `price_id` en `/superadmin/planes` (campo *Stripe price ID* del plan
   Premium).
3. Crea un **webhook endpoint** → `https://reservaprimero.com/api/webhooks/stripe`
   con los eventos: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copia el *Signing secret* →
   `STRIPE_WEBHOOK_SECRET`.

## 5. Tareas programadas (pg_cron en Supabase)

`/api/cron/reminders` hace dos cosas: los recordatorios de cita al cliente
(24 h y 2 h antes) y el resumen diario de agenda al equipo, que sale a la hora
local configurada por cada negocio en Configuración → Avisos al equipo.

La llama cada 30 min **pg_cron desde Supabase**, no Vercel Cron: el plan Hobby
sólo admite crons diarios y, si `vercel.json` pide uno más frecuente, Vercel
rechaza el despliegue entero sin llegar a compilar. Con un cron diario los
recordatorios de 2 h no serían fiables (la ventana de captura es de 35 min).

La migración `20261012120000_reminders_pg_cron.sql` crea el job. Falta darle,
una vez, la URL y el secreto en **Supabase → SQL Editor** (quedan cifrados en
Vault, no en el repo). `<CRON_SECRET>` es el mismo valor que en Vercel:

```sql
select vault.create_secret('https://reservaprimero.com', 'app_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
```

Comprobación, pasada la siguiente media hora en punto:

```sql
-- el job corrió
select status, return_message, start_time
from cron.job_run_details order by start_time desc limit 3;
-- y la app respondió 200 con {"ok":true,...}
select status_code, content, created
from net._http_response order by created desc limit 3;
```

Un 401 significa que `cron_secret` no coincide con `CRON_SECRET` de Vercel.
Para cambiarlo: `select vault.update_secret(id, '<nuevo>') from vault.secrets
where name = 'cron_secret';`

Si algún día se pasa a Vercel Pro, puede volver a `vercel.json`
(`"crons": [{ "path": "/api/cron/reminders", "schedule": "0,30 * * * *" }]`)
y quitar el job con `select cron.unschedule('reservaprimero-reminders');`.
Las dos cosas a la vez no rompen nada (los envíos son idempotentes), pero
duplican trabajo.

## 6. WhatsApp (Cloud API de Meta)

Sale todo desde **un único número de ReservaPrimero**; el nombre del negocio va
dentro del mensaje. Sólo se envía a clientes de negocios cuyo plan tenga
`features.whatsapp = true`.

1. En [business.facebook.com](https://business.facebook.com) verifica el
   negocio y crea una app de tipo *Business* con el producto **WhatsApp**.
2. Da de alta el número (no puede estar usándose en la app de WhatsApp). En
   *WhatsApp → API Setup* copia el **Phone number ID** →
   `WHATSAPP_PHONE_NUMBER_ID`.
3. En *Business Settings → System users* crea un usuario de sistema (Admin),
   asígnale la app y el WhatsApp Business Account, y genera un token
   **permanente** con los permisos `whatsapp_business_messaging` y
   `whatsapp_business_management` → `WHATSAPP_ACCESS_TOKEN`. El token temporal
   de *API Setup* caduca en 24 h; no sirve para producción.
4. Añade un método de pago en el WhatsApp Business Account: Meta cobra por
   mensaje de plantilla entregado.
5. En *WhatsApp Manager → Message templates* crea estas cuatro plantillas,
   categoría **Utility**, idioma **Spanish** (`es`; si eliges otra variante,
   p. ej. `es_MX`, pon ese código en `WHATSAPP_TEMPLATE_LANG`). El nombre y el
   orden de las variables tienen que coincidir con
   `lib/notifications/whatsapp.ts`; el texto puede ajustarse.

**`cita_confirmada`**
```
Hola {{1}}, tu cita en {{2}} está confirmada.

Servicio: {{3}}
Fecha: {{4}}
Con: {{5}}

Para cancelar o reagendar: {{6}}

¡Te esperamos!
```

**`cita_reagendada`**
```
Hola {{1}}, tu cita en {{2}} fue reagendada.

Servicio: {{3}}
Nueva fecha: {{4}}
Con: {{5}}

Para cancelar o reagendar: {{6}}

¡Te esperamos!
```

**`cita_recordatorio`**
```
Hola {{1}}, te recordamos tu cita en {{2}}.

Servicio: {{3}}
Fecha: {{4}}
Con: {{5}}

Si necesitas cancelar o reagendar: {{6}}

¡Nos vemos pronto!
```

**`cita_cancelada`**
```
Hola {{1}}, tu cita en {{2}} de {{3}} del {{4}} fue cancelada.

Puedes volver a reservar cuando quieras.
```

Meta revisa cada plantilla (de minutos a un día). Mientras no esté aprobada,
los envíos fallan y quedan en `notifications_log` con `status = failed` y el
error de Meta.

## 7. Dominio `reservaprimero.com`

El dominio canónico es `reservaprimero.com`, sin `www`: todas las URLs que
genera la app (correos, WhatsApp, QR, Stripe, invitaciones) salen de
`NEXT_PUBLIC_APP_URL`.

1. **Vercel → Project → Settings → Domains**: añade `reservaprimero.com` y
   `www.reservaprimero.com`, y configura este último como *Redirect to*
   `reservaprimero.com` (308). Así la sesión vive en un único host.
2. **Cloudflare → DNS**: crea los registros que pida Vercel (A del apex y
   CNAME de `www`) con *Proxy status* **DNS only** (nube gris). Con el proxy
   naranja, Vercel puede no emitir o no renovar el certificado; si se quiere
   el proxy, SSL/TLS en **Full (strict)**.
3. **Resend → Domains**: añade `reservaprimero.com` y crea en Cloudflare los
   registros SPF/DKIM que indique (DNS only). Después
   `RESEND_FROM_EMAIL="ReservaPrimero <reservas@reservaprimero.com>"`.
4. **Cloudflare → Turnstile**: en el widget, hostname `reservaprimero.com`.
5. **Supabase** (Site URL y Redirect URLs, §3) y **Stripe** (webhook, §4) ya
   apuntan a `reservaprimero.com`.

Comprobación:

```bash
curl -sI https://www.reservaprimero.com | grep -i -E "^HTTP|^location"   # 308 → https://reservaprimero.com/
curl -s -o /dev/null -w "%{http_code}\n" https://reservaprimero.com/login # 200
```

## 8. Checklist de QA manual antes de anunciar

- [ ] Registro de negocio → onboarding → panel.
- [ ] "¿La olvidaste?" en `/login` → correo → enlace abierto en otro dispositivo → nueva contraseña → panel.
- [ ] Crear servicio, staff (con correo → aceptar invitación → panel `/staff`), horario.
- [ ] Reserva pública en `/{slug}` (con y sin "cualquiera disponible").
- [ ] Cancelar y reagendar desde el enlace `/reservas/{token}`.
- [ ] Agenda admin: confirmar / completar / no-show / cancelar.
- [ ] (con WhatsApp) reservar con tu propio número en un negocio con plan Premium → llega `cita_confirmada`.
- [ ] (con Stripe) upgrade a Premium → webhook actualiza el plan → límite Free deja de aplicar.
- [ ] Superadmin: suspender un negocio → su página pública deja de cargar.
