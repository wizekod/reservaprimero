-- ═══════════════════════════════════════════════════════════════════════════
-- El teléfono es la identidad del cliente dentro de un negocio.
--
-- "600 11 22 33", "+34 600112233" y "0034600112233" son la misma persona y
-- hasta ahora creaban tres fichas. Se guarda el teléfono tal como lo escribió
-- el cliente (para mostrarlo) y, aparte, una clave normalizada `phone_key`
-- que es la que lleva el índice único.
--
-- La clave se calcula en Postgres con un trigger, no en TypeScript: así da
-- igual qué camino escriba (reserva pública, alta manual desde el panel, CRUD
-- de clientes o un UPDATE a mano) — nunca se desincroniza.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Prefijo telefónico del país ────────────────────────────────────────────
-- Para unificar la forma nacional con la internacional hace falta saber el
-- prefijo del negocio. Se deduce de la zona horaria, que ya tenemos, así que
-- ningún negocio existente necesita tocar nada.
alter table public.businesses
  add column if not exists phone_country_code text;

alter table public.businesses
  drop constraint if exists businesses_dial_chk;
alter table public.businesses
  add constraint businesses_dial_chk
  check (phone_country_code is null or phone_country_code ~ '^[0-9]{1,4}$');

update public.businesses set phone_country_code = case
  when timezone = 'America/Santiago'                 then '56'
  when timezone = 'America/Argentina/Buenos_Aires'   then '54'
  when timezone = 'America/Montevideo'               then '598'
  when timezone = 'America/Asuncion'                 then '595'
  when timezone = 'America/La_Paz'                   then '591'
  when timezone = 'America/Lima'                     then '51'
  when timezone = 'America/Bogota'                   then '57'
  when timezone = 'America/Guayaquil'                then '593'
  when timezone = 'America/Caracas'                  then '58'
  when timezone in ('America/Mexico_City', 'America/Monterrey', 'America/Tijuana')
                                                     then '52'
  when timezone = 'America/Guatemala'                then '502'
  when timezone = 'America/Costa_Rica'               then '506'
  when timezone = 'America/Panama'                   then '507'
  when timezone in ('America/Santo_Domingo', 'America/New_York', 'America/Los_Angeles')
                                                     then '1'
  when timezone = 'Europe/Madrid'                    then '34'
  else null
end
where phone_country_code is null;

-- ── Normalización ──────────────────────────────────────────────────────────
-- Dígitos del teléfono, sin el 00 internacional y sin el prefijo del país del
-- negocio. Sólo se quita el prefijo si lo que queda sigue siendo un número
-- plausible (>= 8 dígitos); así "34600112233" → "600112233" pero un número
-- corto no se queda en nada.
create or replace function public.customer_phone_key(raw text, dial text)
returns text
language sql
immutable
set search_path = public
as $$
  with d as (
    select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as n
  ), s as (
    select case when n like '00%' then substr(n, 3) else n end as n from d
  )
  select nullif(
    case
      when dial is not null
       and n like dial || '%'
       and length(n) - length(dial) >= 8
      then substr(n, length(dial) + 1)
      else n
    end,
  '')
  from s
$$;

alter table public.customers
  add column if not exists phone_key text;

create or replace function public.set_customer_phone_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dial text;
begin
  select b.phone_country_code into dial
    from public.businesses b where b.id = new.business_id;
  new.phone_key := public.customer_phone_key(new.phone, dial);
  return new;
end;
$$;

drop trigger if exists customers_set_phone_key on public.customers;
create trigger customers_set_phone_key
  before insert or update of phone, business_id on public.customers
  for each row execute function public.set_customer_phone_key();

-- Si el negocio cambia su prefijo, las claves de sus clientes dejan de ser
-- coherentes. Se recalculan en el acto. Si al hacerlo dos fichas colisionan,
-- el índice único de abajo aborta el cambio: son datos que hay que revisar a
-- mano, no fusionar a ciegas.
create or replace function public.resync_customer_phone_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
     set phone_key = public.customer_phone_key(phone, new.phone_country_code)
   where business_id = new.id;
  return new;
end;
$$;

drop trigger if exists businesses_resync_phone_keys on public.businesses;
create trigger businesses_resync_phone_keys
  after update of phone_country_code on public.businesses
  for each row
  when (old.phone_country_code is distinct from new.phone_country_code)
  execute function public.resync_customer_phone_keys();

-- ── Backfill ───────────────────────────────────────────────────────────────
update public.customers c
   set phone_key = public.customer_phone_key(c.phone, b.phone_country_code)
  from public.businesses b
 where b.id = c.business_id;

-- ── Fusión de duplicados preexistentes ─────────────────────────────────────
-- Sobrevive la ficha más antigua; se le completan los huecos con los datos de
-- las demás y se repuntan sus citas (la FK appointments.customer_id es
-- ON DELETE RESTRICT, así que sin esto el DELETE fallaría).
do $$
declare
  r        record;
  survivor uuid;
begin
  for r in
    select business_id, phone_key, array_agg(id order by created_at, id) as ids
      from public.customers
     where phone_key is not null
     group by business_id, phone_key
    having count(*) > 1
  loop
    survivor := r.ids[1];

    update public.customers c set
      email = coalesce(c.email, (
        select d.email from public.customers d
         where d.id = any(r.ids) and d.id <> survivor and d.email is not null
         order by d.created_at limit 1)),
      notes = coalesce(c.notes, (
        select d.notes from public.customers d
         where d.id = any(r.ids) and d.id <> survivor and d.notes is not null
         order by d.created_at limit 1))
    where c.id = survivor;

    update public.appointments
       set customer_id = survivor
     where customer_id = any(r.ids) and customer_id <> survivor;

    delete from public.customers
     where id = any(r.ids) and id <> survivor;

    raise notice 'customers: % fichas fusionadas en % (teléfono %)',
      array_length(r.ids, 1), survivor, r.phone_key;
  end loop;
end;
$$;

-- ── Unicidad ───────────────────────────────────────────────────────────────
-- Índice parcial en vez de constraint: un UNIQUE no admite WHERE y hay que
-- dejar fuera a los clientes sin teléfono.
create unique index if not exists customers_business_phone_key_uidx
  on public.customers (business_id, phone_key)
  where phone_key is not null;

-- El panel busca clientes por nombre y por teléfono.
create index if not exists customers_business_name_idx
  on public.customers (business_id, name);
