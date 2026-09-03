-- ═══════════════════════════════════════════════════════════════════════════
-- Parámetros de reserva por negocio (CLAUDE.md §6: "ventana mínima de
-- anticipación", política de cancelación). Alimentan el cálculo de
-- disponibilidad y el flujo de cancelación por token.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.businesses
  add column if not exists min_booking_notice_hours  integer not null default 2,
  add column if not exists max_booking_days          integer not null default 30,
  add column if not exists slot_interval_minutes     integer not null default 15,
  add column if not exists cancellation_notice_hours integer not null default 12;

alter table public.businesses
  add constraint businesses_min_notice_chk    check (min_booking_notice_hours between 0 and 720),
  add constraint businesses_max_days_chk      check (max_booking_days between 1 and 365),
  add constraint businesses_slot_interval_chk check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  add constraint businesses_cancel_notice_chk check (cancellation_notice_hours between 0 and 720);

-- anon necesita leer estos campos para calcular/mostrar disponibilidad.
grant select
  (min_booking_notice_hours, max_booking_days, slot_interval_minutes, cancellation_notice_hours)
  on public.businesses to anon;
