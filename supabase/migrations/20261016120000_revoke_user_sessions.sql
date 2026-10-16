-- ═══════════════════════════════════════════════════════════════════════════
-- Cerrar todas las sesiones de un usuario desde el servidor.
--
-- Cuando el admin de un negocio le pone una contraseña nueva a alguien de su
-- staff (olvido, o una persona que ya no debe entrar), las sesiones abiertas
-- con la contraseña vieja tienen que caer. La API admin de Supabase sólo
-- cierra sesiones a partir del JWT del propio usuario, no por id; borrando
-- sus filas de auth.sessions se invalidan sus refresh tokens (en cascada).
-- El access token vigente expira solo, en menos de una hora.
--
-- Sólo la llama el servidor con service_role: nadie con la anon key ni con
-- una sesión normal puede cerrar sesiones ajenas.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
