-- ═══════════════════════════════════════════════════════════════════════════
-- Estaciones de trabajo (sillones, camillas, cabinas…).
--
-- Un negocio con N estaciones no puede tener más de N citas a la vez entre
-- los servicios que ocupan estación, aunque haya profesionales libres.
--
--   businesses.station_count     null = sin límite (como hasta ahora)
--   services.uses_station        el servicio ocupa una estación
--   appointments.station_override el admin la agendó a sabiendas de que no
--                                quedaba estación libre
--
-- Una cita ocupa su estación desde que empieza hasta que termina más el
-- tiempo de limpieza (`buffer_minutes`) de su servicio.
--
-- La disponibilidad ya no ofrece horarios sin estación; esto es la red de
-- seguridad para dos reservas simultáneas al último hueco. Un EXCLUDE no
-- sirve (cuenta solapes de a dos, no hasta N), así que es un trigger que
-- serializa por negocio con un advisory lock y cuenta.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.businesses
  add column if not exists station_count integer;
alter table public.businesses
  drop constraint if exists businesses_station_count_chk,
  add constraint businesses_station_count_chk
    check (station_count is null or station_count between 1 and 500);

alter table public.services
  add column if not exists uses_station boolean not null default true;

alter table public.appointments
  add column if not exists station_override boolean not null default false;

-- La página pública calcula disponibilidad con service_role, pero se deja
-- leer igual que el resto de parámetros de reserva.
grant select (station_count) on public.businesses to anon;
grant select (uses_station) on public.services to anon;

-- ── Máximo de estaciones ocupadas a la vez dentro de [p_start, p_end) ──────
-- Cuenta citas confirmadas de servicios con estación, incluidas las forzadas
-- por el admin (físicamente también ocupan su sitio).
create or replace function public.stations_in_use(
  p_business_id uuid,
  p_start       timestamptz,
  p_end         timestamptz,
  p_exclude_id  uuid default null
) returns integer
language sql stable security definer set search_path = public
as $$
  with busy as (
    select a.start_at as s,
           a.end_at + make_interval(mins => s.buffer_minutes) as e
      from public.appointments a
      join public.services s on s.id = a.service_id
     where a.business_id = p_business_id
       and a.status = 'confirmed'
       and s.uses_station
       and (p_exclude_id is null or a.id <> p_exclude_id)
       and a.start_at < p_end
       and a.end_at + make_interval(mins => s.buffer_minutes) > p_start
  ),
  -- El máximo de solapes se alcanza en el inicio de alguna cita (o en el
  -- inicio del intervalo pedido).
  points as (
    select greatest(s, p_start) as t from busy
    union
    select p_start
  )
  select coalesce(max((select count(*) from busy b where b.s <= p.t and b.e > p.t)), 0)::integer
    from points p
$$;

revoke all on function public.stations_in_use(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.stations_in_use(uuid, timestamptz, timestamptz, uuid)
  to service_role;

-- ── Triggers ───────────────────────────────────────────────────────────────
-- Saltarse el límite es una decisión del admin que sólo registra el servidor
-- tras comprobar su rol; desde una sesión de usuario no se puede marcar (ni
-- el staff con permiso de gestionar citas). Va aparte y SIN security definer:
-- dentro de una función definer `current_user` es su dueño y
-- `is_server_role()` diría siempre que sí.
create or replace function public.guard_station_override()
returns trigger
language plpgsql
as $$
begin
  if new.station_override
     and (tg_op = 'INSERT' or not old.station_override)
     and not public.is_server_role() then
    raise exception 'appointments: station_override sólo lo marca el servidor'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_guard_station_override on public.appointments;
create trigger appointments_guard_station_override
  before insert or update on public.appointments
  for each row execute function public.guard_station_override();

-- Ésta sí es definer: tiene que contar TODAS las citas del negocio, también
-- las que la RLS no le enseña a un profesional que reactiva una suya.
create or replace function public.guard_station_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_count  integer;
  v_uses   boolean;
  v_buffer integer;
  v_in_use integer;
begin
  if new.status <> 'confirmed' or new.station_override then
    return new;
  end if;

  -- Un UPDATE que no cambia nada de lo que ocupa estación no se revisa:
  -- editar la nota de una cita no debe fallar porque el admin forzó otra.
  if tg_op = 'UPDATE'
     and old.status = 'confirmed'
     and new.start_at = old.start_at
     and new.end_at = old.end_at
     and new.service_id = old.service_id
     and new.business_id = old.business_id then
    return new;
  end if;

  select b.station_count into v_count
    from public.businesses b where b.id = new.business_id;
  if v_count is null then
    return new;
  end if;

  select s.uses_station, s.buffer_minutes into v_uses, v_buffer
    from public.services s where s.id = new.service_id;
  if not coalesce(v_uses, false) then
    return new;
  end if;

  -- Una reserva a la vez por negocio hasta el COMMIT: así dos clientes que
  -- piden el último hueco al mismo tiempo no entran los dos.
  perform pg_advisory_xact_lock(hashtextextended('stations:' || new.business_id::text, 0));

  v_in_use := public.stations_in_use(
    new.business_id,
    new.start_at,
    new.end_at + make_interval(mins => coalesce(v_buffer, 0)),
    new.id
  );

  if v_in_use >= v_count then
    raise exception 'No hay estaciones de trabajo libres en ese horario'
      using errcode = 'RP409', detail = format('%s de %s en uso', v_in_use, v_count);
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_guard_stations on public.appointments;
create trigger appointments_guard_stations
  before insert or update on public.appointments
  for each row execute function public.guard_station_capacity();
