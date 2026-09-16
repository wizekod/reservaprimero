-- ═══════════════════════════════════════════════════════════════════════════
-- El prefijo telefónico se rellenó al migrar, pero un negocio NUEVO nacía sin
-- él y entonces `customer_phone_key` devuelve null para los números escritos
-- en forma nacional: el negocio se quedaba sin identidad por teléfono desde el
-- primer día.
--
-- Se deduce en la base y no en el alta de la aplicación para que valga para
-- cualquier camino (onboarding, seeds, superadmin, inserciones a mano).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.phone_dial_code(tz text)
returns text
language sql
immutable
set search_path = public
as $$
  select case tz
    when 'America/Santiago'               then '56'
    when 'America/Argentina/Buenos_Aires' then '54'
    when 'America/Montevideo'             then '598'
    when 'America/Asuncion'               then '595'
    when 'America/La_Paz'                 then '591'
    when 'America/Lima'                   then '51'
    when 'America/Bogota'                 then '57'
    when 'America/Guayaquil'              then '593'
    when 'America/Caracas'                then '58'
    when 'America/Mexico_City'            then '52'
    when 'America/Monterrey'              then '52'
    when 'America/Tijuana'                then '52'
    when 'America/Guatemala'              then '502'
    when 'America/Costa_Rica'             then '506'
    when 'America/Panama'                 then '507'
    when 'America/Santo_Domingo'          then '1'
    when 'America/New_York'               then '1'
    when 'America/Los_Angeles'            then '1'
    when 'Europe/Madrid'                  then '34'
    else null
  end
$$;

-- Sólo rellena si falta: una elección explícita del negocio manda siempre.
create or replace function public.set_business_dial_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone_country_code is null then
    new.phone_country_code := public.phone_dial_code(new.timezone);
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_set_dial_code on public.businesses;
create trigger businesses_set_dial_code
  before insert or update of timezone on public.businesses
  for each row execute function public.set_business_dial_code();

-- Por si quedó alguno sin prefijo entre las dos migraciones.
update public.businesses
   set phone_country_code = public.phone_dial_code(timezone)
 where phone_country_code is null;
