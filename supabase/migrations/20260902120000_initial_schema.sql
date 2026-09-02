-- ═══════════════════════════════════════════════════════════════════════════
-- ReservaPrimero — esquema inicial (CLAUDE.md §5)
-- ═══════════════════════════════════════════════════════════════════════════

-- btree_gist vive en el schema `extensions` de Supabase; lo dejamos en el
-- search_path para que el opclass gist sobre uuid (=) resuelva al crear el
-- constraint EXCLUDE de appointments.
set search_path = public, extensions;

create extension if not exists pgcrypto;                          -- gen_random_uuid()
create extension if not exists btree_gist with schema extensions; -- EXCLUDE anti-doble-booking

-- ─────────────────────────────── enums ───────────────────────────────────
create type public.user_role            as enum ('superadmin', 'business_admin', 'staff');
create type public.business_status      as enum ('active', 'suspended', 'trial');
create type public.appointment_status   as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.notification_channel as enum ('email', 'whatsapp');
create type public.notification_type    as enum ('confirmation', 'reminder', 'cancellation');
create type public.notification_status  as enum ('pending', 'sent', 'failed');

-- ─────────────────────── helper: updated_at trigger ──────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════ subscription_plans ══════════════════════════
create table public.subscription_plans (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  stripe_price_id       text unique,
  monthly_booking_limit integer,                       -- null = ilimitado
  price                 numeric(10,2) not null default 0,
  features              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
comment on column public.subscription_plans.monthly_booking_limit is 'null = ilimitado';

-- ═══════════════════════════════ businesses ══════════════════════════════
create table public.businesses (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name                   text not null,
  timezone               text not null default 'America/Santiago',
  logo_url               text,
  brand_color            text,
  phone                  text,
  address                text,
  status                 public.business_status not null default 'trial',
  plan_id                uuid references public.subscription_plans(id) on delete set null,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  subscription_status    text,                          -- espeja los estados de Stripe
  trial_ends_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  constraint businesses_slug_not_reserved check (
    slug not in (
      'admin','superadmin','staff','api','auth','login','signup','registro',
      'dashboard','precios','pricing','terminos','privacidad','about','nosotros',
      'soporte','help','cron','webhooks'
    )
  )
);
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ════════════════════════════════ profiles ══════════════════════════════
-- Extiende auth.users. role por defecto = business_admin (flujo principal:
-- dueño de negocio que se registra). superadmin/staff se asignan aparte.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'business_admin',
  full_name   text,
  phone       text,
  business_id uuid references public.businesses(id) on delete set null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- superadmin nunca pertenece a un negocio
  constraint profiles_superadmin_no_business check (role <> 'superadmin' or business_id is null)
);
create index profiles_business_id_idx on public.profiles(business_id);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ════════════════════════════════ services ══════════════════════════════
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  description      text,
  duration_minutes integer not null check (duration_minutes > 0),
  price            numeric(10,2) not null default 0,
  color            text,
  buffer_minutes   integer not null default 0 check (buffer_minutes >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index services_business_id_idx on public.services(business_id);
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ═════════════════════════════ staff_members ════════════════════════════
create table public.staff_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,  -- null = staff sin login aún
  display_name text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, profile_id)
);
create index staff_members_business_id_idx on public.staff_members(business_id);
create index staff_members_profile_id_idx  on public.staff_members(profile_id);
create trigger staff_members_set_updated_at before update on public.staff_members
  for each row execute function public.set_updated_at();

-- ═════════════════════════════ staff_services ═══════════════════════════
create table public.staff_services (
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  primary key (staff_member_id, service_id)
);
create index staff_services_service_id_idx on public.staff_services(service_id);

-- ═══════════════════════════ availability_rules ═════════════════════════
-- Horario semanal recurrente. day_of_week: 0 = domingo … 6 = sábado (JS getDay).
create table public.availability_rules (
  id              uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  created_at      timestamptz not null default now(),
  constraint availability_rules_time_order check (start_time < end_time)
);
create index availability_rules_staff_idx on public.availability_rules(staff_member_id);

-- ════════════════════════ availability_exceptions ══════════════════════
-- Feriados / días libres / horario especial para una fecha concreta.
create table public.availability_exceptions (
  id              uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  date            date not null,
  is_closed       boolean not null default true,
  start_time      time,
  end_time        time,
  created_at      timestamptz not null default now(),
  constraint availability_exceptions_time check (
    is_closed
    or (start_time is not null and end_time is not null and start_time < end_time)
  ),
  unique (staff_member_id, date)
);
create index availability_exceptions_staff_idx on public.availability_exceptions(staff_member_id);

-- ═══════════════════════════════ customers ═════════════════════════════
-- CRM ligero por negocio.
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index customers_business_id_idx    on public.customers(business_id);
create index customers_business_phone_idx on public.customers(business_id, phone);
create index customers_business_email_idx on public.customers(business_id, email);
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ═════════════════════════════ appointments ════════════════════════════
create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id)    on delete cascade,
  service_id      uuid not null references public.services(id)      on delete restrict,
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  customer_id     uuid not null references public.customers(id)     on delete restrict,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  status          public.appointment_status not null default 'pending',
  cancel_token    uuid not null default gen_random_uuid(),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint appointments_time_order check (start_at < end_at),
  -- Anti-doble-booking a nivel DB: sin solapes para un mismo staff mientras
  -- la cita esté activa (CLAUDE.md §5).
  constraint appointments_no_double_booking exclude using gist (
    staff_member_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status in ('pending', 'confirmed'))
);
create unique index appointments_cancel_token_idx on public.appointments(cancel_token);
create index appointments_business_start_idx   on public.appointments(business_id, start_at);
create index appointments_business_created_idx on public.appointments(business_id, created_at); -- límite plan Free
create index appointments_staff_start_idx      on public.appointments(staff_member_id, start_at);
create index appointments_customer_idx         on public.appointments(customer_id);
create index appointments_status_start_idx     on public.appointments(status, start_at);       -- cron recordatorios
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ═══════════════════════════ notifications_log ═════════════════════════
-- Trazabilidad de envíos + dedupe. reminder_offset_minutes distingue los
-- distintos recordatorios de una misma cita (CLAUDE.md §8: hasta 3).
create table public.notifications_log (
  id                     uuid primary key default gen_random_uuid(),
  appointment_id         uuid not null references public.appointments(id) on delete cascade,
  channel                public.notification_channel not null,
  type                   public.notification_type not null,
  status                 public.notification_status not null default 'pending',
  reminder_offset_minutes integer,          -- null salvo type = 'reminder'
  error                  text,
  sent_at                timestamptz,
  created_at             timestamptz not null default now()
);
create index notifications_log_appointment_idx on public.notifications_log(appointment_id);
create unique index notifications_log_dedupe_idx
  on public.notifications_log (appointment_id, channel, type, (coalesce(reminder_offset_minutes, -1)))
  where status = 'sent';
