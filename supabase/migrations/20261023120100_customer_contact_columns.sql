-- ═══════════════════════════════════════════════════════════════════════════
-- Segunda mitad de los permisos del staff (ver 20261023120000): el teléfono
-- y el correo de los clientes dejan de leerse directamente de `customers`
-- con una sesión de usuario; sólo salen por la vista `customer_contacts`,
-- que los oculta a quien no tiene permiso.
--
-- APLICAR DESPUÉS de desplegar el código que lee de la vista: el código
-- anterior pide `phone` a `customers` y dejaría de cargar la agenda.
--
-- Un REVOKE de columnas no resta a un GRANT de tabla (Postgres), así que se
-- quita el SELECT de tabla y se vuelve a dar columna por columna. Escribir
-- (insert/update) sigue igual: la RLS y el trigger de contacto lo controlan.
-- service_role no cambia.
-- ═══════════════════════════════════════════════════════════════════════════

revoke select on public.customers from authenticated;
grant select (id, business_id, name, created_at, updated_at)
  on public.customers to authenticated;
