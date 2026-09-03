-- ═══════════════════════════════════════════════════════════════════════════
-- handle_new_user: si el alta trae `staff_member_id` en el metadata (invitación
-- de staff), el profile nace con rol `staff` en vez de `business_admin`. Así un
-- staff invitado no puede colarse por /onboarding a crear un negocio.
--
-- No se confía en `business_id` del metadata: el vínculo real (profiles.role
-- confirmado + business_id + staff_members.profile_id) lo hace, ya validado
-- contra staff_members.invited_email, el server action `setInitialPassword`.
-- Un signup normal que intente inyectar `staff_member_id` sólo consigue una
-- cuenta `staff` sin negocio ni staff_members enlazado: inofensiva.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ? 'staff_member_id' then 'staff'::public.user_role
      else 'business_admin'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
