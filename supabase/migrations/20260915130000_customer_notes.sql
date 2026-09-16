-- ═══════════════════════════════════════════════════════════════════════════
-- Historia clínica del cliente.
--
-- Va en su propia tabla y NO como columna de `customers` porque el staff
-- puede leer la fila del cliente (política `customers_read`) y en Postgres un
-- REVOKE por columna no resta a un GRANT de tabla — el proyecto ya tropezó con
-- eso en 20260903030000_protect_privileged_columns.sql. La RLS filtra filas,
-- nunca columnas, así que la única frontera limpia es una tabla aparte sin
-- política para el staff.
--
-- Se modela como línea de tiempo y no como un campo largo: una historia
-- clínica es qué se hizo y cuándo, dos administradores editando un mismo
-- textarea se pisan en silencio, y así cada entrada puede colgar de la cita en
-- la que se escribió. En una barbería sirve igual ("tinte 7.3, alérgica al
-- amoniaco").
-- ═══════════════════════════════════════════════════════════════════════════

-- Para que `customer_notes.business_id` no pueda divergir del negocio real del
-- cliente: la política depende de esa columna, así que tiene que ser fiable.
alter table public.customers
  drop constraint if exists customers_id_business_uk;
alter table public.customers
  add constraint customers_id_business_uk unique (id, business_id);

create table if not exists public.customer_notes (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null,
  customer_id    uuid not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  author_id      uuid references public.profiles(id)     on delete set null,
  body           text not null check (btrim(body) <> '' and length(body) <= 5000),
  pinned         boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint customer_notes_customer_fk
    foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete cascade
);

create index if not exists customer_notes_customer_idx
  on public.customer_notes (customer_id, pinned desc, created_at desc);
create index if not exists customer_notes_business_idx
  on public.customer_notes (business_id);

create trigger customer_notes_set_updated_at
  before update on public.customer_notes
  for each row execute function public.set_updated_at();

alter table public.customer_notes enable row level security;

-- OJO: el `grant ... on all tables in schema public to authenticated` de
-- 20260902120100 fue una foto de aquel momento y no hay `alter default
-- privileges` en ninguna migración, así que las tablas nuevas necesitan su
-- GRANT explícito o no las ve ni el admin.
grant select, insert, update, delete on public.customer_notes to authenticated;
revoke all on public.customer_notes from anon;

-- Una sola política, sólo para el admin del negocio. El staff también es
-- `authenticated` pero no encaja en ninguna política: RLS deniega por defecto
-- y ve cero filas.
--
-- `is_superadmin()` se omite a propósito, en contra de la convención del resto
-- del esquema: el operador de la plataforma no tiene por qué leer historias
-- clínicas de los pacientes de sus clientes.
create policy customer_notes_business_admin_all on public.customer_notes
  for all to authenticated
  using      (public.is_business_admin(business_id))
  with check (public.is_business_admin(business_id));

-- `customers.notes` no lo escribía nadie y competía conceptualmente con esta
-- tabla: dejarlo invita a que alguien escriba datos clínicos en una columna
-- que el staff sí puede leer.
alter table public.customers drop column if exists notes;
