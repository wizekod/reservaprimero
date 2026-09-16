-- ═══════════════════════════════════════════════════════════════════════════
-- Avisos al equipo.
--
-- Hasta ahora ningún aviso llegaba al staff: sólo al cliente y, en algunos
-- casos, al dueño. Se añaden dos cosas:
--
--   1. aviso inmediato cuando a un profesional le agendan, le cancelan o le
--      reagendan una cita;
--   2. un resumen con su agenda del día, a primera hora.
--
-- El recordatorio de 24h/2h de cada cita NO se le duplica: un profesional con
-- ocho citas recibiría dieciséis mensajes al día.
--
-- Para (1) no hace falta migración: `notifications_log.recipient` es texto
-- libre y ya entra en el índice único de dedupe. Para (2) sí, porque un
-- resumen agrupa N citas y `notifications_log.appointment_id` es NOT NULL.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.daily_digest_log (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  -- null = el resumen del negocio entero, que va al dueño.
  staff_member_id uuid references public.staff_members(id) on delete cascade,
  local_date      date not null,
  sent_at         timestamptz not null default now(),
  unique (business_id, staff_member_id, local_date)
);

-- Postgres considera distintos dos NULL en un UNIQUE, así que el resumen del
-- dueño (staff_member_id null) se mandaría cada vez que corre el cron. Este
-- índice parcial es el que de verdad lo evita.
create unique index if not exists daily_digest_log_owner_uidx
  on public.daily_digest_log (business_id, local_date)
  where staff_member_id is null;

alter table public.daily_digest_log enable row level security;

-- Sólo lo escribe el cron (service_role, que salta la RLS). Sin políticas,
-- nadie más lo ve: es un registro interno, no un dato del negocio.
revoke all on public.daily_digest_log from anon, authenticated;

-- ── Ajustes por negocio ────────────────────────────────────────────────────
alter table public.businesses
  add column if not exists notify_staff_on_booking boolean not null default true,
  add column if not exists staff_digest_hour       integer not null default 7;

alter table public.businesses
  drop constraint if exists businesses_digest_hour_chk;
alter table public.businesses
  add constraint businesses_digest_hour_chk
  check (staff_digest_hour between 0 and 23);
