# Base de datos — Supabase

Migraciones SQL versionadas en `supabase/migrations/`:

| Archivo | Contenido |
|---|---|
| `20260902120000_initial_schema.sql` | 11 tablas de CLAUDE.md §5, enums, índices, triggers `updated_at`, constraint anti-doble-booking (`EXCLUDE USING gist`) |
| `20260902120100_rls_and_grants.sql` | Helpers de rol/tenant (`SECURITY DEFINER`), trigger `handle_new_user`, GRANTs por rol, RLS habilitado + policies en todas las tablas |
| `20260902120200_seed_subscription_plans.sql` | Planes `Free` (30 reservas/mes) y `Premium` (ilimitado). Idempotente. `price` y `stripe_price_id` son placeholders. |

## Aplicar a un proyecto hosted (lo que necesito de ti)

1. Crea el proyecto en <https://supabase.com/dashboard> (región cercana a tus negocios).
2. En el proyecto: **Project Settings → General** copia el *Reference ID*.
3. Desde la raíz del repo:

   ```bash
   npx supabase login                 # abre el navegador
   npx supabase link --project-ref <REFERENCE_ID>
   npx supabase db push               # aplica las 3 migraciones
   ```

4. Verifica:

   ```bash
   npx supabase db push --dry-run     # debe decir "no schema changes"
   ```

   Y en el **SQL Editor** del dashboard:

   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
   -- rowsecurity = true en las 11 tablas
   select name, monthly_booking_limit from public.subscription_plans;
   -- Free / 30  +  Premium / null
   ```

5. Pásame de **Project Settings → API**:
   - `Project URL`  → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (¡no la expongas!)

## Nota sobre versión de Postgres

`config.toml` fija `major_version = 17`. Si tu proyecto hosted usa otra, corre
`SHOW server_version;` en el SQL Editor y ajusta el valor antes de `db push`.

## Desarrollo local (opcional, requiere Docker)

```bash
npx supabase start      # levanta Postgres + Auth + Studio en local
npx supabase db reset   # recrea el esquema desde las migraciones
```

## Modelo de seguridad (resumen)

- **`service_role`** (tiene `BYPASSRLS`) — sólo en API routes server-side: creación
  de reservas (con Turnstile + rate limit + chequeo de plan + anti-doble-booking),
  webhooks de Stripe, cron de recordatorios, alta de negocio, acciones de superadmin.
- **`authenticated`** — `superadmin` / `business_admin` / `staff`, aislados por policy
  (`business_id` vía `current_business_id()`; staff limitado a sus `staff_members`).
- **`anon`** — sólo lectura de columnas públicas de `businesses`, `services`,
  `staff_members`, `staff_services`, `availability_*` para la página `/{slug}`.
- Columnas de facturación de `businesses` y `profiles.role` / `profiles.business_id`
  tienen `REVOKE UPDATE` sobre `authenticated`: sólo se tocan server-side.
