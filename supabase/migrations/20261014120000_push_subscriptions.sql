-- ═══════════════════════════════════════════════════════════════════════════
-- Notificaciones push (web app) para el equipo.
--
-- Los avisos internos (cita nueva / cancelada / reagendada y el resumen
-- diario) llegaban sólo por correo. Ahora también como push al navegador o
-- a la web app instalada, sin coste por mensaje como en WhatsApp.
--
-- Una fila por dispositivo: el mismo usuario puede tener el móvil y la
-- computadora. `endpoint` es la URL única que da el servicio push del
-- navegador; si el navegador la invalida, el envío devuelve 404/410 y la
-- fila se borra.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Cada usuario ve y borra sólo sus dispositivos. El alta pasa por una
-- acción de servidor con service_role: un endpoint que antes fue de otra
-- cuenta (computadora compartida) tiene que poder cambiar de dueño, y esa
-- fila no la ve el usuario nuevo.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_own_select on public.push_subscriptions;
create policy push_subscriptions_own_select on public.push_subscriptions
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_delete on public.push_subscriptions
  for delete to authenticated
  using (profile_id = auth.uid());

-- Canal nuevo en el log de envíos, para el dedupe de los avisos por cita.
alter type public.notification_channel add value if not exists 'push';
