-- ═══════════════════════════════════════════════════════════════════════════
-- El nombre del cliente se guarda en mayúsculas.
--
-- Se normaliza en la base y no en cada formulario, por lo mismo que la clave
-- telefónica: hay cuatro caminos que escriben clientes (reserva pública, alta
-- manual, CRUD de clientes y el RPC `upsert_customer`) y da igual cuál se use.
--
-- Se reaprovecha el trigger que ya calculaba `phone_key`, ampliándolo a
-- `name`: es la misma responsabilidad —dejar la fila en su forma canónica— y
-- dos triggers sobre la misma tabla se acaban desincronizando.
-- ═══════════════════════════════════════════════════════════════════════════

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
  new.name := upper(btrim(new.name));
  return new;
end;
$$;

comment on function public.set_customer_phone_key() is
  'Normaliza la fila de customers: clave telefónica en E.164 y nombre en mayúsculas.';

drop trigger if exists customers_set_phone_key on public.customers;
create trigger customers_set_phone_key
  before insert or update of phone, business_id, name on public.customers
  for each row execute function public.set_customer_phone_key();

-- Las fichas que ya existían.
update public.customers
   set name = upper(btrim(name))
 where name <> upper(btrim(name));

-- La página pública de reservas valida el largo del teléfono según el país
-- del negocio, así que necesita leer esa columna. Los grants de `anon` sobre
-- `businesses` son POR COLUMNA.
grant select (phone_country_code) on public.businesses to anon;
