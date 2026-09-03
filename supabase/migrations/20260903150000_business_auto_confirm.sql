-- ═══════════════════════════════════════════════════════════════════════════
-- businesses.auto_confirm_bookings: si una reserva pública nace 'confirmed'
-- (true, por defecto) o 'pending' a la espera de aprobación del negocio.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.businesses
  add column if not exists auto_confirm_bookings boolean not null default true;

grant select (auto_confirm_bookings) on public.businesses to anon;
