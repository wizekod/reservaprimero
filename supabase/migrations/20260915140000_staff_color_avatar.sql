-- ═══════════════════════════════════════════════════════════════════════════
-- Color y avatar por profesional.
--
-- El color se usa para teñir sus citas en el calendario: con dos o tres
-- profesionales, distinguir de quién es cada bloque de un vistazo importa más
-- que cualquier otra cosa en esa pantalla.
--
-- El avatar lo consume el bloque siguiente (subida a Storage); la columna se
-- crea aquí para no tener que volver a tocar los grants de `anon`.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.staff_members
  add column if not exists color      text,
  add column if not exists avatar_url text;

alter table public.staff_members
  drop constraint if exists staff_members_color_chk;
alter table public.staff_members
  add constraint staff_members_color_chk
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- OJO: el grant de `anon` sobre staff_members es POR COLUMNA
-- (20260902120100_rls_and_grants.sql) y hoy sólo lista
-- (id, business_id, display_name, active). Sin ampliarlo, la página pública
-- de reservas falla al pedir las columnas nuevas.
grant select (color, avatar_url) on public.staff_members to anon;
