-- ═══════════════════════════════════════════════════════════════════════════
-- Planes de suscripción base (CLAUDE.md §9). Idempotente.
-- price y stripe_price_id son PLACEHOLDERS: Carlos fija el precio real y pega
-- el price_id de Stripe desde el dashboard de superadmin (bloque Stripe, Fase 1).
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.subscription_plans (name, monthly_booking_limit, price, features)
values
  ('Free',    30,   0, '{"whatsapp": false, "google_calendar": false, "reports": false, "widget": false, "reminders_max": 1}'::jsonb),
  ('Premium', null, 0, '{"whatsapp": true,  "google_calendar": true,  "reports": true,  "widget": true,  "reminders_max": 3}'::jsonb)
on conflict (name) do nothing;
