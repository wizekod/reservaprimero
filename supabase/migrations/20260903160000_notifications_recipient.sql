-- ═══════════════════════════════════════════════════════════════════════════
-- notifications_log.recipient: distingue el envío al cliente del aviso interno
-- al negocio (misma cita, mismo canal/tipo). Entra en el índice de dedupe.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.notifications_log
  add column if not exists recipient text not null default 'customer';

drop index if exists public.notifications_log_dedupe_idx;
create unique index notifications_log_dedupe_idx
  on public.notifications_log
     (appointment_id, channel, type, recipient, (coalesce(reminder_offset_minutes, -1)))
  where status = 'sent';
