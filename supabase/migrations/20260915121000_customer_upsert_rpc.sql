-- ═══════════════════════════════════════════════════════════════════════════
-- Cierra la identidad por teléfono:
--
--  1. `phone_key` pasa a ser E.164 completo ("+34600112233") en vez de la
--     forma nacional. Cuesta lo mismo y sirve para el enlace de WhatsApp y
--     para buscar por sufijo sin saber el prefijo del negocio.
--  2. `upsert_customer`: find-or-create atómico. Sustituye al bloque
--     "buscar y si no insertar" que estaba duplicado en TypeScript, donde dos
--     reservas simultáneas con el mismo teléfono podían crear dos fichas y
--     donde el filtro `.or()` interpolaba el email del usuario en la sintaxis
--     de PostgREST.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Clave en E.164 ──────────────────────────────────────────────────────
-- Devuelve NULL si el número no es canonizable: un teléfono basura no sirve
-- como identidad, y así el índice único parcial lo ignora en vez de fusionar
-- por error dos fichas que no tienen nada que ver.
create or replace function public.customer_phone_key(raw text, dial text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text;
begin
  if raw is null then return null; end if;

  s := regexp_replace(raw, '[^0-9+]', '', 'g');
  if s = '' then return null; end if;

  -- El 00 de marcación internacional equivale al '+'.
  if left(s, 2) = '00' then s := '+' || substr(s, 3); end if;

  if left(s, 1) = '+' then
    -- Internacional explícito: el prefijo ya viene en el número.
    s := '+' || regexp_replace(substr(s, 2), '[^0-9]', '', 'g');
  else
    -- Nacional: se quita el prefijo de salida (el 0 de Argentina; en España
    -- ningún número empieza por 0) y se antepone el del país del negocio.
    s := regexp_replace(regexp_replace(s, '[^0-9]', '', 'g'), '^0+', '');
    if dial is null or s = '' then return null; end if;
    s := '+' || dial || s;
  end if;

  if s !~ '^\+[1-9][0-9]{6,14}$' then return null; end if;
  return s;
end;
$$;

-- Recalcular con el formato nuevo. El trigger no salta en un UPDATE que no
-- toca `phone` ni `business_id`, así que se asigna a mano.
update public.customers c
   set phone_key = public.customer_phone_key(c.phone, b.phone_country_code)
  from public.businesses b
 where b.id = c.business_id;

alter table public.customers
  drop constraint if exists customers_phone_key_chk;
alter table public.customers
  add constraint customers_phone_key_chk
  check (phone_key is null or phone_key ~ '^\+[1-9][0-9]{6,14}$');

-- ── 2. Find-or-create atómico ──────────────────────────────────────────────
-- Con el índice único en su sitio, dos INSERT simultáneos con el mismo
-- teléfono no dan error: el segundo espera al primero y cae en el DO UPDATE.
-- No hace falta reintentar desde la aplicación.
create or replace function public.upsert_customer(
  p_business_id uuid,
  p_name        text,
  p_phone       text,
  p_email       text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dial  text;
  v_key   text;
  v_id    uuid;
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(btrim(lower(p_email)), '');
  v_name  text := btrim(p_name);
begin
  select b.phone_country_code into v_dial
    from public.businesses b where b.id = p_business_id;
  if not found then
    raise exception 'negocio no encontrado' using errcode = 'P0002';
  end if;

  v_key := public.customer_phone_key(v_phone, v_dial);

  -- Sin clave utilizable no hay identidad que reutilizar: ficha suelta.
  if v_key is null then
    insert into public.customers (business_id, name, phone, email)
    values (p_business_id, v_name, v_phone, v_email)
    returning id into v_id;
    return v_id;
  end if;

  -- Los datos ya guardados mandan; lo que llega sólo rellena huecos. Si la
  -- clínica tiene "María García Ruiz" y ella reserva como "maria", la ficha
  -- no se degrada. Sobrescribir es cosa del formulario de Clientes.
  insert into public.customers (business_id, name, phone, email)
  values (p_business_id, v_name, v_phone, v_email)
  on conflict (business_id, phone_key) where phone_key is not null
  do update set
    name  = case when btrim(coalesce(customers.name, '')) = ''
                 then excluded.name else customers.name end,
    email = coalesce(customers.email, excluded.email),
    phone = coalesce(customers.phone, excluded.phone)
  returning id into v_id;

  return v_id;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto en las funciones nuevas.
revoke all on function public.upsert_customer(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.upsert_customer(uuid, text, text, text)
  to service_role;
