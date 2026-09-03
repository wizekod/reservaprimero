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

## 2. Variables de entorno en Vercel

| Variable | Necesaria para | Dónde se obtiene |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | siempre | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | siempre | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | siempre (server) | idem (secreto) |
| `NEXT_PUBLIC_APP_URL` | siempre | `https://reservoprimero.com` |
| `CRON_SECRET` | recordatorios | genera uno aleatorio (`openssl rand -hex 32`) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | email | Resend → API Keys + dominio verificado |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp | Twilio Console (formato `whatsapp:+1...`) |
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

`vercel.json` ya define el cron de recordatorios (`/api/cron/reminders`, cada
30 min). En Hobby el mínimo es diario; para cada 30 min se necesita plan Pro.
Vercel envía `Authorization: Bearer $CRON_SECRET` automáticamente.

## 6. Checklist de QA manual antes de anunciar

- [ ] Registro de negocio → onboarding → panel.
- [ ] Crear servicio, staff (con correo → aceptar invitación → panel `/staff`), horario.
- [ ] Reserva pública en `/{slug}` (con y sin "cualquiera disponible").
- [ ] Cancelar y reagendar desde el enlace `/reservas/{token}`.
- [ ] Agenda admin: confirmar / completar / no-show / cancelar.
- [ ] (con Stripe) upgrade a Premium → webhook actualiza el plan → límite Free deja de aplicar.
- [ ] Superadmin: suspender un negocio → su página pública deja de cargar.
