-- ═══════════════════════════════════════════════════════════════════════════
-- El logo del negocio pasa a subirse como el avatar del staff y la imagen del
-- servicio, en vez de pegar una URL a mano.
--
-- Se renombra la columna en lugar de añadir una nueva: no hay ningún logo
-- guardado todavía y mantener `logo_url` al lado de `logo_path` dejaría dos
-- conceptos compitiendo, que es justo lo que se evitó con `customers.notes`.
--
-- El renombrado conserva los privilegios por columna (van por attnum), pero el
-- GRANT se repite igualmente: los de `anon` sobre `businesses` son por columna
-- y olvidarlos rompe la página pública en silencio.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.businesses rename column logo_url to logo_path;

grant select (logo_path) on public.businesses to anon;
