-- ═══════════════════════════════════════════════════════════════════════════
-- Fix de seguridad: el `REVOKE UPDATE (col) ... FROM authenticated` de
-- 20260902120100 NO surte efecto porque `authenticated` tiene GRANT UPDATE a
-- nivel de tabla (Postgres: un REVOKE de columna no resta a un grant de tabla).
--
-- Se sustituye por triggers BEFORE UPDATE que rechazan cambios en columnas
-- privilegiadas cuando el rol de sesión no es de servidor. Las escrituras
-- legítimas (webhook Stripe, onboarding, superadmin) usan `service_role`.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_server_role()
returns boolean
language sql
stable
as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
$$;

-- ─────────────────────────── businesses ────────────────────────────────
create or replace function public.guard_business_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if public.is_server_role() then
    return new;
  end if;
  if new.status              is distinct from old.status
  or new.plan_id             is distinct from old.plan_id
  or new.stripe_customer_id  is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  or new.subscription_status is distinct from old.subscription_status
  or new.trial_ends_at       is distinct from old.trial_ends_at then
    raise exception 'businesses: columnas de estado/facturación sólo se modifican server-side'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_guard_privileged on public.businesses;
create trigger businesses_guard_privileged
  before update on public.businesses
  for each row execute function public.guard_business_privileged_columns();

-- ──────────────────────────── profiles ─────────────────────────────────
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if public.is_server_role() then
    return new;
  end if;
  if new.role        is distinct from old.role
  or new.business_id is distinct from old.business_id then
    raise exception 'profiles: role y business_id sólo se modifican server-side'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- Los REVOKE de 20260902120100 quedan (inertes pero inofensivos); estos
-- triggers son la barrera real.
