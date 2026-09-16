-- ═══════════════════════════════════════════════════════════════════════════
-- Almacenamiento de imágenes: avatar del profesional e imagen del servicio.
--
-- Un solo bucket y público: las dos se enseñan en la página de reservas, que
-- no tiene login. Firmar URLs sería una vuelta al servidor por imagen en cada
-- render y enlaces que caducan, a cambio de una confidencialidad que no se
-- necesita.
--
-- La ruta es `{business_id}/{tipo}/{uuid}.{ext}`: el primer segmento permite
-- que la política compruebe el inquilino, y el nombre uuid hace que cada
-- objeto sea inmutable — sustituir una imagen escribe una ruta nueva, así que
-- no hay que invalidar cachés ni renombrar nada.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- El cast a uuid reventaría con una ruta cualquiera, así que se comprueba la
-- forma antes. `is_business_admin` es STABLE y delega en funciones SECURITY
-- DEFINER, de modo que se puede invocar desde una política de storage sin
-- conceder al usuario lectura sobre `profiles`.
create or replace function public.owns_media_path(object_name text)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(object_name))[1]
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_superadmin()
      or public.is_business_admin(((storage.foldername(object_name))[1])::uuid)
    else false
  end
$$;
grant execute on function public.owns_media_path(text) to authenticated;

drop policy if exists media_admin_read   on storage.objects;
drop policy if exists media_admin_insert on storage.objects;
drop policy if exists media_admin_update on storage.objects;
drop policy if exists media_admin_delete on storage.objects;

-- No se concede nada a `anon`: en un bucket público la URL
-- /storage/v1/object/public/... se sirve sin pasar por estas políticas, así
-- que las imágenes se ven igual y, al no haber policy de select para anon,
-- nadie puede listar el contenido de la carpeta de un negocio.
create policy media_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.owns_media_path(name));

create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.owns_media_path(name));

create policy media_admin_update on storage.objects
  for update to authenticated
  using      (bucket_id = 'media' and public.owns_media_path(name))
  with check (bucket_id = 'media' and public.owns_media_path(name));

create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.owns_media_path(name));

-- ── Columnas ───────────────────────────────────────────────────────────────
-- Se guarda la RUTA, no la URL: la URL pública lleva dentro la referencia del
-- proyecto Supabase, así que restaurar en otro proyecto o poner un dominio
-- propio dejaría todas las URLs guardadas inservibles. Con la ruta, cambia un
-- único helper.
alter table public.staff_members rename column avatar_url to avatar_path;

alter table public.services
  add column if not exists image_path text;

-- Los grants de `anon` son POR COLUMNA: sin esto la página pública no ve las
-- imágenes.
grant select (avatar_path) on public.staff_members to anon;
grant select (image_path)  on public.services      to anon;
