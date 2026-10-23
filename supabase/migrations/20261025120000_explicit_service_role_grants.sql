-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTs explícitos para las tablas creadas después de 20260902120100.
--
-- Desde el 30-oct-2026 Supabase deja de conceder automáticamente acceso por
-- la Data API a las tablas nuevas de `public`. En el proyecto actual no
-- cambia nada (las tablas existentes conservan sus permisos), pero estas
-- tres dependían de ese permiso automático para `service_role`, así que un
-- proyecto nuevo, una rama de preview o un `supabase db reset` las dejaría
-- inaccesibles para el servidor (avisos, push, resumen diario).
--
-- Sólo añade permisos que en producción ya existen: es idempotente.
-- `anon` y `authenticated` quedan como los dejó cada migración original.
--
-- Regla desde ahora: toda migración que cree una tabla o vista en `public`
-- incluye sus GRANT para service_role (y authenticated/anon si aplica).
-- ═══════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.customer_notes     to service_role;
grant select, insert, update, delete on public.daily_digest_log   to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
