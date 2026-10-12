-- Recordatorios y resumen diario disparados desde Postgres (pg_cron + pg_net).
--
-- El plan Hobby de Vercel sólo admite crons diarios y rechaza el despliegue
-- entero si vercel.json pide uno más frecuente. Los recordatorios necesitan
-- cadencia de 30 min (abren una ventana de 35), así que es Postgres quien
-- llama cada media hora a /api/cron/reminders con el mismo
-- `Authorization: Bearer $CRON_SECRET` que mandaría Vercel.
--
-- La URL y el secreto viven en Supabase Vault, no en el repo. Se cargan una
-- vez por proyecto (DEPLOY.md §5):
--
--   select vault.create_secret('https://reservaprimero.com', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- Sin esos dos secretos (p. ej. en Supabase local) el job no hace nada.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Esquema fuera de la API: lo que se crea en `public` es invocable como RPC
-- por cualquiera con la anon key.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.call_reminders_cron()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  -- Asíncrono: la respuesta queda en net._http_response. El tope coincide
  -- con el maxDuration de la ruta (60 s).
  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.call_reminders_cron() from public, anon, authenticated;

-- Mismo nombre = se actualiza en vez de duplicarse al reaplicar.
select cron.schedule(
  'reservaprimero-reminders',
  '0,30 * * * *',
  $$select private.call_reminders_cron()$$
);
