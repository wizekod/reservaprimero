# ReservaPrimero

SaaS de agendamiento de citas para negocios de servicios. Cada negocio obtiene
una página pública de reservas en `reservaprimero.com/{slug}`.

> El plan maestro completo (visión, arquitectura, modelo de datos, roadmap por
> fases) vive en [`CLAUDE.md`](./CLAUDE.md) y es la fuente de verdad del proyecto.

## Stack

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres +
Auth + RLS) · Stripe Subscriptions · Resend · Twilio WhatsApp · Vercel.

## Desarrollo local

```bash
nvm use                 # Node 20.9+
npm install
cp .env.example .env.local   # y rellena los valores (ver CLAUDE.md §13)
npm run dev                  # http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`

## Base de datos (Supabase)

Las migraciones SQL viven en `supabase/migrations/`. Ver
[`supabase/README.md`](./supabase/README.md) para aplicarlas a un proyecto
hosted o local.

## Estructura

```
app/
  (marketing)/            landing, precios, registro de negocio
  [slug]/                 página pública de reserva de cada negocio
  (admin)/dashboard/      panel admin de negocio
  (staff)/dashboard/      panel de staff
  (superadmin)/dashboard/ panel de superadmin
  api/                    webhooks (stripe, whatsapp), cron, appointments
lib/
  supabase/  stripe/  notifications/  availability/
components/
  ui/ (shadcn)  booking/  dashboard/
```
