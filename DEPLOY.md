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
| `NEXT_PUBLIC_APP_URL` | siempre | `https://reservoprimero.com` |
| `CRON_SECRET` | recordatorios | genera uno aleatorio (`openssl rand -hex 32`) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | email | Resend → API Keys + dominio verificado |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | Meta Business Manager (ver §6) |
| `WHATSAPP_TEMPLATE_LANG` | WhatsApp (opcional) | idioma de las plantillas, por defecto `es` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | anti-bot | Cloudflare → Turnstile |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pagos | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | pagos | Stripe → Webhooks (ver §4) |

## 3. Supabase Auth (para invitaciones de staff y confirmación de correo)

- **URL Configuration → Redirect URLs**: añade
  `http://localhost:3000/**` y `https://reservoprimero.com/**`.
- **Email Templates** (*Invite user*, *Confirm signup*, *Reset password*): el
  enlace debe apuntar a
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/definir-clave`
  (ajusta `type`/`next` por plantilla).
- **SMTP Settings**: configura un SMTP propio; el de Supabase por defecto solo
  sirve para pruebas (pocos correos/hora).

## 4. Stripe

1. Crea un **producto "Premium"** con un **precio recurrente mensual**.
2. Pega el `price_id` en `/superadmin/planes` (campo *Stripe price ID* del plan
   Premium).
3. Crea un **webhook endpoint** → `https://reservoprimero.com/api/webhooks/stripe`
   con los eventos: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copia el *Signing secret* →
   `STRIPE_WEBHOOK_SECRET`.

## 5. Vercel Cron

`vercel.json` ya define el cron (`/api/cron/reminders`, cada 30 min). Esa ruta
hace dos cosas: los recordatorios de cita al cliente (24 h y 2 h antes) y el
resumen diario de agenda al equipo, que sale a la hora local configurada por
cada negocio en Configuración → Avisos al equipo.

En Hobby el mínimo es diario; para cada 30 min se necesita plan Pro. **Con un
cron diario los recordatorios de 2 h dejan de ser fiables** (la ventana de
captura es de 35 min), pero el resumen diario sigue funcionando si la hora del
cron coincide con la hora configurada. Vercel envía
`Authorization: Bearer $CRON_SECRET` automáticamente.

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

## 7. Checklist de QA manual antes de anunciar

- [ ] Registro de negocio → onboarding → panel.
- [ ] Crear servicio, staff (con correo → aceptar invitación → panel `/staff`), horario.
- [ ] Reserva pública en `/{slug}` (con y sin "cualquiera disponible").
- [ ] Cancelar y reagendar desde el enlace `/reservas/{token}`.
- [ ] Agenda admin: confirmar / completar / no-show / cancelar.
- [ ] (con WhatsApp) reservar con tu propio número en un negocio con plan Premium → llega `cita_confirmada`.
- [ ] (con Stripe) upgrade a Premium → webhook actualiza el plan → límite Free deja de aplicar.
- [ ] Superadmin: suspender un negocio → su página pública deja de cargar.
