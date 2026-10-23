-- ═══════════════════════════════════════════════════════════════════════════
-- Permisos por profesional, que el admin del negocio enciende o apaga en la
-- ficha de cada miembro del staff.
--
--   can_view_all_appointments   ver la agenda de todo el equipo (sólo ver)
--   booking_scope               crear citas: none · own (sólo para sí) · any
--   can_manage_all_appointments cambiar estado / cancelar citas de otros
--   customers_scope             sección Clientes: none · own (los que ha
--                               atendido) · all
--   can_edit_customers          crear y editar fichas (dar de alta una ficha
--                               suelta exige customers_scope = all)
--   can_see_customer_contact    ver teléfono y correo de los clientes
--
-- Todo arranca como hasta ahora: el staff sólo ve sus citas, con el teléfono
-- de sus clientes. Nada cambia hasta que el admin active algo.
--
-- La RLS es el control real; la interfaz sólo esconde lo que no se puede
-- usar. Crear citas no pasa por aquí: lo hace una acción de servidor con
-- service_role que comprueba `booking_scope` antes de escribir.
--
-- El teléfono y el correo se ocultan por columnas, cosa que la RLS (que filtra
-- filas) no sabe hacer. La vista `customer_contacts` los entrega sólo a quien
-- tiene permiso; la siguiente migración (20261023120100) le quita al rol
-- `authenticated` el acceso directo a esas columnas de `customers`. Van
-- separadas para poder desplegar el código nuevo entre una y otra.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ────────────────────────────────────────────────────────────
alter table public.staff_members
  add column if not exists can_view_all_appointments   boolean not null default false,
  add column if not exists booking_scope               text    not null default 'none',
  add column if not exists can_manage_all_appointments boolean not null default false,
  add column if not exists customers_scope             text    not null default 'none',
  add column if not exists can_edit_customers          boolean not null default false,
  add column if not exists can_see_customer_contact    boolean not null default true;

alter table public.staff_members
  drop constraint if exists staff_members_booking_scope_chk,
  add constraint staff_members_booking_scope_chk
    check (booking_scope in ('none', 'own', 'any')),
  drop constraint if exists staff_members_customers_scope_chk,
  add constraint staff_members_customers_scope_chk
    check (customers_scope in ('none', 'own', 'all')),
  -- Gestionar citas ajenas sin verlas no tiene sentido.
  drop constraint if exists staff_members_manage_needs_view_chk,
  add constraint staff_members_manage_needs_view_chk
    check (not can_manage_all_appointments or can_view_all_appointments),
  -- Editar fichas exige poder abrirlas.
  drop constraint if exists staff_members_edit_needs_customers_chk,
  add constraint staff_members_edit_needs_customers_chk
    check (not can_edit_customers or customers_scope <> 'none');

-- ── 2. Helpers ─────────────────────────────────────────────────────────────
-- Ficha de staff de la sesión actual, sólo si su rol es `staff`. Para el
-- dueño que también atiende devuelve null: como admin ya lo ve todo.
create or replace function public.current_staff()
returns public.staff_members
language sql stable security definer set search_path = public
as $$
  select s.*
    from public.staff_members s
    join public.profiles p on p.id = s.profile_id
   where s.profile_id = (select auth.uid())
     and p.role = 'staff'
     and s.business_id = p.business_id
   limit 1
$$;

-- ¿La sesión actual puede leer esta ficha de cliente? Una sola definición
-- para la RLS de `customers` y para la vista de contactos.
create or replace function public.can_read_customer(p_customer_id uuid, p_business_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.staff_members;
begin
  if public.is_superadmin() or public.is_business_admin(p_business_id) then
    return true;
  end if;

  me := public.current_staff();
  if me.id is null or me.business_id <> p_business_id then
    return false;
  end if;

  if me.customers_scope = 'all' then
    return true;
  end if;

  -- Los clientes de las citas que puede ver: las suyas, o las de todo el
  -- equipo si ve la agenda completa (la agenda necesita el nombre).
  return exists (
    select 1 from public.appointments a
     where a.customer_id = p_customer_id
       and (a.staff_member_id = me.id
            or (me.can_view_all_appointments and a.business_id = p_business_id))
  );
end;
$$;

-- ¿Es cliente "suyo"? (alguna cita con este profesional). Para el alcance
-- `own` de la sección Clientes, que no incluye los de sus compañeros.
create or replace function public.is_my_customer(p_customer_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.appointments a
     where a.customer_id = p_customer_id
       and a.staff_member_id in (select public.current_staff_member_ids())
  )
$$;

create or replace function public.can_see_customer_contact(p_business_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.staff_members;
begin
  if public.is_superadmin() or public.is_business_admin(p_business_id) then
    return true;
  end if;
  me := public.current_staff();
  return me.id is not null
     and me.business_id = p_business_id
     and me.can_see_customer_contact;
end;
$$;

revoke all on function public.current_staff() from public, anon;
revoke all on function public.can_read_customer(uuid, uuid) from public, anon;
revoke all on function public.is_my_customer(uuid) from public, anon;
revoke all on function public.can_see_customer_contact(uuid) from public, anon;
grant execute on function
  public.current_staff(),
  public.can_read_customer(uuid, uuid),
  public.is_my_customer(uuid),
  public.can_see_customer_contact(uuid)
to authenticated, service_role;

-- ── 3. Citas ───────────────────────────────────────────────────────────────
drop policy if exists appointments_read on public.appointments;
create policy appointments_read on public.appointments
  for select to authenticated
  using (
    public.is_superadmin()
    or public.is_business_admin(business_id)
    or (
      public.current_user_role() = 'staff'
      and (
        staff_member_id in (select public.current_staff_member_ids())
        or (
          business_id = public.current_business_id()
          and coalesce((select (public.current_staff()).can_view_all_appointments), false)
        )
      )
    )
  );

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (
    public.current_user_role() = 'staff'
    and (
      staff_member_id in (select public.current_staff_member_ids())
      or (
        business_id = public.current_business_id()
        and coalesce((select (public.current_staff()).can_manage_all_appointments), false)
      )
    )
  )
  with check (
    public.current_user_role() = 'staff'
    and (
      staff_member_id in (select public.current_staff_member_ids())
      or (
        business_id = public.current_business_id()
        and coalesce((select (public.current_staff()).can_manage_all_appointments), false)
      )
    )
  );

-- ── 4. Clientes ────────────────────────────────────────────────────────────
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated
  using (public.can_read_customer(id, business_id));

-- Alta de fichas sueltas: sólo con acceso a todos los clientes (con `own`
-- una ficha nueva, sin citas, no la podría ni abrir).
drop policy if exists customers_staff_insert on public.customers;
create policy customers_staff_insert on public.customers
  for insert to authenticated
  with check (
    public.current_user_role() = 'staff'
    and business_id = public.current_business_id()
    and coalesce((select (public.current_staff()).can_edit_customers), false)
    and coalesce((select (public.current_staff()).customers_scope), 'none') = 'all'
  );

drop policy if exists customers_staff_update on public.customers;
create policy customers_staff_update on public.customers
  for update to authenticated
  using (
    public.current_user_role() = 'staff'
    and business_id = public.current_business_id()
    and coalesce((select (public.current_staff()).can_edit_customers), false)
    and (
      coalesce((select (public.current_staff()).customers_scope), 'none') = 'all'
      or public.is_my_customer(id)
    )
  )
  with check (
    public.current_user_role() = 'staff'
    and business_id = public.current_business_id()
    and coalesce((select (public.current_staff()).can_edit_customers), false)
  );

-- Sin permiso de contacto, el staff no puede cambiar teléfono ni correo
-- (tampoco borrarlos): no los ve, así que no los toca.
create or replace function public.guard_customer_contact_columns()
returns trigger
language plpgsql
as $$
begin
  if public.is_server_role() then
    return new;
  end if;
  if (new.phone is distinct from old.phone or new.email is distinct from old.email)
     and not public.can_see_customer_contact(old.business_id) then
    raise exception 'customers: sin permiso para cambiar el contacto'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_guard_contact on public.customers;
create trigger customers_guard_contact
  before update on public.customers
  for each row execute function public.guard_customer_contact_columns();

-- ── 5. Vista de contactos ──────────────────────────────────────────────────
-- Corre con los permisos de su dueño (no de quien consulta), así que la
-- condición de filas la pone ella misma con `can_read_customer`, la misma
-- función que la RLS. Las columnas de contacto salen en null sin permiso;
-- `phone_last4` siempre, para distinguir a dos clientes que se llaman igual.
create or replace view public.customer_contacts
with (security_barrier = true)
as
select
  c.id,
  c.business_id,
  c.name,
  c.created_at,
  case when public.can_see_customer_contact(c.business_id) then c.phone end     as phone,
  case when public.can_see_customer_contact(c.business_id) then c.phone_key end as phone_key,
  case when public.can_see_customer_contact(c.business_id) then c.email end     as email,
  right(c.phone_key, 4) as phone_last4,
  public.is_my_customer(c.id) as is_mine
from public.customers c
where public.can_read_customer(c.id, c.business_id);

revoke all on public.customer_contacts from public, anon;
grant select on public.customer_contacts to authenticated, service_role;
