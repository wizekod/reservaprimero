-- ═══════════════════════════════════════════════════════════════════════════
-- ReservaPrimero — RLS, helpers de rol/tenant y GRANTs (CLAUDE.md §4, §5, §10)
--
-- Modelo:
--   · service_role  → usado por las API routes server-side (booking, webhooks
--                     Stripe, cron). Tiene BYPASSRLS: ignora estas policies.
--   · authenticated → superadmin / business_admin / staff. Aislados por policy.
--   · anon          → sólo lectura de datos públicos para la página de reserva.
--
-- El tenant y el rol se resuelven leyendo public.profiles vía funciones
-- SECURITY DEFINER (evita configurar un custom access-token hook y aplica los
-- cambios de rol/negocio al instante, sin re-emitir el JWT).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── helpers de sesión ──────────────────────────
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function public.current_business_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select business_id from public.profiles where id = (select auth.uid()) $$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.current_staff_member_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select id from public.staff_members where profile_id = (select auth.uid()) $$;

-- ──────────────── trigger: crea profiles al alta en auth.users ───────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════ GRANTs ═════════════════════════════════
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated: privilegios de tabla; las filas las filtran las policies.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function
  public.current_user_role(), public.current_business_id(),
  public.is_superadmin(), public.current_staff_member_ids()
to authenticated;

-- Columnas sensibles: sólo se escriben server-side con service_role.
--  · businesses.*billing → webhook de Stripe.
--  · profiles.role / profiles.business_id → server action de onboarding /
--    acciones de superadmin (evita que un usuario se auto-asigne a otro negocio).
revoke update (status, plan_id, stripe_customer_id, stripe_subscription_id,
               subscription_status, trial_ends_at) on public.businesses from authenticated;
revoke update (role, business_id) on public.profiles from authenticated;

-- anon: sólo lectura, y sólo de las columnas que necesita la página pública /{slug}.
revoke all on all tables in schema public from anon;
grant select (id, name, monthly_booking_limit, price, features)
  on public.subscription_plans to anon;
grant select (id, slug, name, timezone, logo_url, brand_color, phone, address, status)
  on public.businesses to anon;
grant select (id, business_id, name, description, duration_minutes, price, color, buffer_minutes, active)
  on public.services to anon;
grant select (id, business_id, display_name, active)
  on public.staff_members to anon;
grant select (staff_member_id, service_id)
  on public.staff_services to anon;
grant select on public.availability_rules      to anon;
grant select on public.availability_exceptions to anon;

-- ═══════════════════════════ enable RLS (todas) ════════════════════════
alter table public.subscription_plans      enable row level security;
alter table public.businesses              enable row level security;
alter table public.profiles                enable row level security;
alter table public.services                enable row level security;
alter table public.staff_members           enable row level security;
alter table public.staff_services          enable row level security;
alter table public.availability_rules      enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.customers               enable row level security;
alter table public.appointments            enable row level security;
alter table public.notifications_log       enable row level security;

-- ═══════════════════════════ subscription_plans ═══════════════════════════
create policy plans_read_all on public.subscription_plans
  for select to anon, authenticated using (true);
create policy plans_superadmin_write on public.subscription_plans
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ════════════════════════════════ businesses ════════════════════════════
create policy businesses_public_read on public.businesses
  for select to anon using (status in ('active', 'trial'));

create policy businesses_member_read on public.businesses
  for select to authenticated
  using (public.is_superadmin() or id = public.current_business_id());

-- El alta de negocio (crear businesses + enlazar profiles.business_id) se hace
-- en un server action con service_role, de forma atómica. authenticated no
-- inserta negocios directamente; sólo superadmin.
create policy businesses_superadmin_insert on public.businesses
  for insert to authenticated
  with check (public.is_superadmin());

create policy businesses_update on public.businesses
  for update to authenticated
  using (
    public.is_superadmin()
    or (public.current_user_role() = 'business_admin' and id = public.current_business_id())
  )
  with check (
    public.is_superadmin()
    or (public.current_user_role() = 'business_admin' and id = public.current_business_id())
  );

create policy businesses_superadmin_delete on public.businesses
  for delete to authenticated using (public.is_superadmin());

-- ═════════════════════════════════ profiles ═════════════════════════════
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_superadmin()
    or (public.current_user_role() = 'business_admin' and business_id = public.current_business_id())
  );

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) or public.is_superadmin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_superadmin())
  with check (id = (select auth.uid()) or public.is_superadmin());

create policy profiles_superadmin_delete on public.profiles
  for delete to authenticated using (public.is_superadmin());

-- ═══════════════ helper local: ¿soy admin de este negocio? ═════════════
create or replace function public.is_business_admin(target_business_id uuid)
returns boolean
language sql stable set search_path = public
as $$
  select public.current_user_role() = 'business_admin'
     and target_business_id is not null
     and target_business_id = public.current_business_id()
$$;
grant execute on function public.is_business_admin(uuid) to authenticated, service_role;

-- ════════════════════════════════ services ══════════════════════════════
create policy services_public_read on public.services
  for select to anon
  using (
    active and exists (
      select 1 from public.businesses b
      where b.id = services.business_id and b.status in ('active', 'trial')
    )
  );

create policy services_member_read on public.services
  for select to authenticated
  using (public.is_superadmin() or business_id = public.current_business_id());

create policy services_admin_write on public.services
  for all to authenticated
  using (public.is_superadmin() or public.is_business_admin(business_id))
  with check (public.is_superadmin() or public.is_business_admin(business_id));

-- ══════════════════════════════ staff_members ═══════════════════════════
create policy staff_members_public_read on public.staff_members
  for select to anon
  using (
    active and exists (
      select 1 from public.businesses b
      where b.id = staff_members.business_id and b.status in ('active', 'trial')
    )
  );

create policy staff_members_member_read on public.staff_members
  for select to authenticated
  using (public.is_superadmin() or business_id = public.current_business_id());

create policy staff_members_admin_write on public.staff_members
  for all to authenticated
  using (public.is_superadmin() or public.is_business_admin(business_id))
  with check (public.is_superadmin() or public.is_business_admin(business_id));

-- ══════════════════════════════ staff_services ══════════════════════════
create policy staff_services_public_read on public.staff_services
  for select to anon
  using (
    exists (
      select 1 from public.staff_members sm
      join public.businesses b on b.id = sm.business_id
      where sm.id = staff_services.staff_member_id
        and sm.active and b.status in ('active', 'trial')
    )
  );

create policy staff_services_member_read on public.staff_services
  for select to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = staff_services.staff_member_id
        and sm.business_id = public.current_business_id()
    )
  );

create policy staff_services_admin_write on public.staff_services
  for all to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = staff_services.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  )
  with check (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = staff_services.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  );

-- ═════════════════════ availability_rules / _exceptions ════════════════
create policy availability_rules_public_read on public.availability_rules
  for select to anon
  using (
    exists (
      select 1 from public.staff_members sm
      join public.businesses b on b.id = sm.business_id
      where sm.id = availability_rules.staff_member_id
        and sm.active and b.status in ('active', 'trial')
    )
  );

create policy availability_rules_member_read on public.availability_rules
  for select to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_rules.staff_member_id
        and sm.business_id = public.current_business_id()
    )
  );

create policy availability_rules_admin_write on public.availability_rules
  for all to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_rules.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  )
  with check (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_rules.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  );

create policy availability_exceptions_public_read on public.availability_exceptions
  for select to anon
  using (
    exists (
      select 1 from public.staff_members sm
      join public.businesses b on b.id = sm.business_id
      where sm.id = availability_exceptions.staff_member_id
        and sm.active and b.status in ('active', 'trial')
    )
  );

create policy availability_exceptions_member_read on public.availability_exceptions
  for select to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_exceptions.staff_member_id
        and sm.business_id = public.current_business_id()
    )
  );

create policy availability_exceptions_admin_write on public.availability_exceptions
  for all to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_exceptions.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  )
  with check (
    public.is_superadmin()
    or exists (
      select 1 from public.staff_members sm
      where sm.id = availability_exceptions.staff_member_id
        and public.is_business_admin(sm.business_id)
    )
  );

-- ═══════════════════════════════ customers ═════════════════════════════
create policy customers_read on public.customers
  for select to authenticated
  using (
    public.is_superadmin()
    or public.is_business_admin(business_id)
    or (
      public.current_user_role() = 'staff'
      and exists (
        select 1 from public.appointments a
        where a.customer_id = customers.id
          and a.staff_member_id in (select public.current_staff_member_ids())
      )
    )
  );

create policy customers_admin_write on public.customers
  for all to authenticated
  using (public.is_superadmin() or public.is_business_admin(business_id))
  with check (public.is_superadmin() or public.is_business_admin(business_id));

-- ═════════════════════════════ appointments ════════════════════════════
create policy appointments_read on public.appointments
  for select to authenticated
  using (
    public.is_superadmin()
    or public.is_business_admin(business_id)
    or (
      public.current_user_role() = 'staff'
      and staff_member_id in (select public.current_staff_member_ids())
    )
  );

create policy appointments_admin_write on public.appointments
  for all to authenticated
  using (public.is_superadmin() or public.is_business_admin(business_id))
  with check (public.is_superadmin() or public.is_business_admin(business_id));

-- staff: sólo puede actualizar (estado / notas) sus propias citas.
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (
    public.current_user_role() = 'staff'
    and staff_member_id in (select public.current_staff_member_ids())
  )
  with check (
    public.current_user_role() = 'staff'
    and staff_member_id in (select public.current_staff_member_ids())
  );

-- ═══════════════════════════ notifications_log ════════════════════════
-- Sólo escribe service_role (senders / cron). authenticated sólo lee.
create policy notifications_log_read on public.notifications_log
  for select to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.appointments a
      where a.id = notifications_log.appointment_id
        and (
          public.is_business_admin(a.business_id)
          or a.staff_member_id in (select public.current_staff_member_ids())
        )
    )
  );
