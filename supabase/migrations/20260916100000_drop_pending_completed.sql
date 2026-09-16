-- ═══════════════════════════════════════════════════════════════════════════
-- Se eliminan los estados `pending` y `completed` de las citas.
--
-- Quedan tres: confirmada, cancelada y no asistió. Una cita pasada que no se
-- canceló y no se marcó como no-show es, implícitamente, una cita atendida —
-- que es como lo cuentan ahora las estadísticas.
--
-- Postgres no permite quitar valores de un enum, así que se crea el tipo nuevo
-- y se cambia la columna. El constraint anti-doble-booking depende de la
-- columna, de modo que hay que soltarlo antes y rehacerlo después.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Reubicar lo que hay. `pending` era "a la espera de aprobación" y
--    `completed` "ya atendida": las dos pasan a confirmada.
update public.appointments
   set status = 'confirmed'
 where status in ('pending', 'completed');

-- 2. El constraint referencia los valores del enum en su WHERE.
alter table public.appointments
  drop constraint if exists appointments_no_double_booking;

-- 3. Cambio de tipo.
alter type public.appointment_status rename to appointment_status_old;

create type public.appointment_status as enum ('confirmed', 'cancelled', 'no_show');

alter table public.appointments
  alter column status drop default;

alter table public.appointments
  alter column status type public.appointment_status
  using status::text::public.appointment_status;

alter table public.appointments
  alter column status set default 'confirmed';

drop type public.appointment_status_old;

-- 4. Rehacer el anti-doble-booking. Antes bloqueaban `pending` y `confirmed`;
--    ahora sólo queda `confirmed` como estado que ocupa el hueco.
alter table public.appointments
  add constraint appointments_no_double_booking exclude using gist (
    staff_member_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed');

-- 5. `auto_confirm_bookings` decidía si una reserva nacía `pending` a la
--    espera de aprobación. Sin ese estado no hay nada que aprobar, y dejar el
--    ajuste sería una casilla que miente.
alter table public.businesses drop column if exists auto_confirm_bookings;
