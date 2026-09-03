-- ═══════════════════════════════════════════════════════════════════════════
-- Fix RLS: `staff_services_admin_write` sólo comprobaba que el staff fuera del
-- negocio del admin, no el servicio. Un admin podía enlazar su staff a un
-- servicio de OTRO negocio. Ahora se exige que staff y servicio pertenezcan al
-- mismo negocio y que el rol de sesión lo administre.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_write_staff_service(
  p_staff_member_id uuid,
  p_service_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members sm
    join public.services s
      on s.business_id = sm.business_id
    where sm.id = p_staff_member_id
      and s.id = p_service_id
      and (public.is_superadmin() or public.is_business_admin(sm.business_id))
  )
$$;
grant execute on function public.can_write_staff_service(uuid, uuid)
  to authenticated, service_role;

drop policy if exists staff_services_admin_write on public.staff_services;
create policy staff_services_admin_write on public.staff_services
  for all to authenticated
  using (public.can_write_staff_service(staff_member_id, service_id))
  with check (public.can_write_staff_service(staff_member_id, service_id));
