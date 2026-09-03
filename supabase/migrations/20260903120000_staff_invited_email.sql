-- ═══════════════════════════════════════════════════════════════════════════
-- staff_members.invited_email — correo al que se envió la invitación.
-- Permite mostrar "invitación pendiente" y reenviarla sin consultar auth.
-- El vínculo real se hace en profile_id cuando el staff acepta y define clave.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.staff_members
  add column if not exists invited_email text;

comment on column public.staff_members.invited_email is
  'Correo invitado; profile_id sigue null hasta que el staff acepta.';
