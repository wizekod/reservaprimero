# ReservaPrimero — Plan Maestro del Proyecto

> Este documento es el contexto de referencia para Claude Code. Contiene la visión del producto, la arquitectura, el modelo de datos, las features y el roadmap por fases. Está pensado para vivir como `CLAUDE.md` en la raíz del repo.

## 1. Visión general

**ReservaPrimero** es un SaaS de agendamiento de citas/turnos para negocios de servicios (barberías, salones de belleza, spas, consultorios médicos, estudios de tatuajes, gimnasios/yoga, talleres, profesionales independientes, etc.), inspirado en [reservasimple.com](https://www.reservasimple.com).

Cada negocio obtiene una página pública de reservas en `reservaprimero.com/{slug}` (ej. `reservaprimero.com/barberiajuanito`) donde sus clientes finales eligen servicio, staff y horario, sin necesidad de crear cuenta ni descargar una app.

Carlos (dueño del SaaS) cobra una **suscripción mensual a cada negocio** vía Stripe. Los negocios, por ahora, cobran a sus propios clientes **en efectivo o por transferencia** (fuera de la plataforma) — no hay pagos en línea al cliente final en esta versión.

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend/Backend | Next.js (App Router) |
| Base de datos + Auth | Supabase (Postgres + Supabase Auth + RLS) |
| UI | shadcn/ui + Tailwind |
| Pagos (SaaS → negocio) | Stripe (Subscriptions + Billing Portal, **no** Stripe Connect) |
| Email transaccional | Resend (o Postmark como alternativa) |
| WhatsApp | Twilio WhatsApp Business API (recomendado) — alternativa: Meta Cloud API directa |
| Hosting | Vercel |
| Repo | GitHub |
| Dominio/DNS | Cloudflare → `reservaprimero.com` apuntando a Vercel |
| Jobs programados | Vercel Cron (recordatorios) |
| Anti-spam | Cloudflare Turnstile + rate limiting en API routes |

## 3. Arquitectura multi-tenant

Multi-tenancy **por path**, no por subdominio: `reservaprimero.com/{slug}`.

- `slug` es único por negocio, editable por el admin del negocio (con validación de disponibilidad).
- Lista de slugs reservados que NO pueden usarse como nombre de negocio (para no chocar con rutas del sistema):
  `admin, superadmin, staff, api, auth, login, signup, registro, dashboard, precios, pricing, terminos, privacidad, about, nosotros, soporte, help, cron, webhooks`
- Todas las rutas de negocio se resuelven con un segmento dinámico `app/[slug]/page.tsx` para la página pública de reserva.
- Aislamiento de datos entre negocios mediante `business_id` en cada tabla + **Row Level Security (RLS)** en Supabase (no solo lógica de aplicación).

## 4. Roles y permisos

| Rol | Alcance | Descripción |
|---|---|---|
| **Superadmin** | Global | Carlos. Ve/gestiona todos los negocios, planes, suscripciones, métricas de la plataforma. Puede suspender/activar cuentas. |
| **Admin de negocio** | Su negocio | Dueño/gerente del negocio. CRUD de servicios, staff, horarios, configuración del negocio, ve todas las citas de su negocio, gestiona su suscripción (Billing Portal). |
| **Staff** | Sus propias citas | Miembro del equipo. Ve y gestiona únicamente las citas asignadas a él/ella, puede marcar completado/no-show. |
| **Cliente final (público)** | Sin cuenta | Accede al link público, agenda sin login. Recibe confirmación y recordatorios. Puede cancelar/reagendar vía link con token (sin password). |

Tabla `profiles` (extiende `auth.users` de Supabase) con columna `role` (`superadmin` | `business_admin` | `staff`) + relación a `business_id` cuando aplique (un usuario admin/staff pertenece a un negocio; superadmin no pertenece a ninguno).

## 5. Modelo de datos (Supabase / Postgres)

Tablas principales (nombres sugeridos, ajustables):

- **`profiles`** — id (=auth.users.id), role, full_name, phone, business_id (nullable), avatar_url, created_at
- **`businesses`** — id, slug (unique), name, timezone, logo_url, brand_color, phone, address, status (`active`/`suspended`/`trial`), plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, created_at
- **`subscription_plans`** — id, name (`Free`, `Premium`, etc.), stripe_price_id, monthly_booking_limit (null = ilimitado), price, features (jsonb)
- **`services`** — id, business_id, name, description, duration_minutes, price, color, active, buffer_minutes (opcional)
- **`staff_members`** — id, business_id, profile_id, display_name, active
- **`staff_services`** — (tabla puente) staff_member_id, service_id — qué servicios puede realizar cada staff
- **`availability_rules`** — id, staff_member_id, day_of_week (0-6), start_time, end_time — horario semanal recurrente
- **`availability_exceptions`** — id, staff_member_id, date, is_closed, start_time, end_time — feriados, días libres, horario especial
- **`customers`** — id, business_id, name, phone, email, notes, created_at — CRM ligero por negocio
- **`appointments`** — id, business_id, service_id, staff_member_id, customer_id, start_at (timestamptz), end_at, status (`pending`/`confirmed`/`cancelled`/`completed`/`no_show`), cancel_token, notes, created_at
- **`notifications_log`** — id, appointment_id, channel (`email`/`whatsapp`), type (`confirmation`/`reminder`/`cancellation`), status, sent_at

**RLS**: políticas por `business_id = auth.jwt() -> business_id` para admin/staff; staff limitado además a `staff_member_id = auth.uid()`; superadmin con política que hace bypass (rol especial o uso de `service_role` en rutas server-side protegidas).

**Prevención de doble-booking**: al crear una cita, validar server-side (no solo en UI) que no exista solapamiento para ese `staff_member_id` en ese rango de tiempo — usar un constraint de exclusión en Postgres (`EXCLUDE USING gist`) o una transacción con lock, no confiar solo en la validación del cliente.

## 6. Flujos clave

### Flujo de reserva (cliente público, `/{slug}`)
1. Elige servicio.
2. Elige staff (o "cualquiera disponible").
3. Ve horarios disponibles calculados en tiempo real (según horario del staff, citas ya tomadas, duración del servicio + buffer).
4. Ingresa nombre, teléfono, email.
5. Confirma → se crea la cita (`pending` o `confirmed` según config del negocio) → se disparan notificaciones (email + WhatsApp) al cliente y notificación interna al negocio.
6. El cliente recibe un link único (token) para cancelar o reagendar sin necesidad de cuenta.

### Flujo admin de negocio
- Dashboard con calendario de todas las citas del negocio (día/semana).
- CRUD de servicios, staff, horarios.
- Configuración del negocio: nombre, slug, logo, zona horaria, política de cancelación, ventana mínima de anticipación para reservar.
- Ver/gestionar su suscripción (redirección a Stripe Billing Portal).

### Flujo staff
- Ve solo sus propias citas (día/semana).
- Marca cita como completada / no-show / cancelada.

### Flujo superadmin
- Listado de todos los negocios con estado (activo/suspendido/trial) y plan.
- Activar/suspender negocios manualmente.
- Métricas globales: total de negocios, MRR estimado (vía Stripe), citas totales en la plataforma.
- Gestión de los planes de suscripción (nombre, precio, límite de reservas).

## 7. Features — paridad con ReservaSimple, organizadas por fase

Esta es la lista completa de lo que hace ReservaSimple hoy. Tú decides qué mover entre fases o cortar por completo — están marcadas con mi recomendación inicial.

### Fase 1 — MVP (lanzamiento)
| Feature | Notas |
|---|---|
| Auth con 3 roles (Supabase Auth) | superadmin / admin negocio / staff |
| Página pública de reserva por negocio (`/slug`) | sin cuenta, sin app |
| Selección de servicio, staff y horario | con cálculo de disponibilidad real |
| Múltiples servicios (duración y precio configurables) | |
| Múltiples profesionales/staff, cada uno con su propio horario | |
| Múltiples "calendarios" (por staff) | |
| Dashboard admin: gestión de citas, servicios, staff, horarios | |
| Dashboard staff: solo sus citas | |
| Dashboard superadmin: negocios, planes, activar/suspender | |
| Notificaciones por **email** (confirmación + recordatorios) | Resend |
| Notificaciones por **WhatsApp** (confirmación + hasta 3 recordatorios) | Twilio WhatsApp API |
| Cancelación/reagendado por el cliente vía link con token | sin login |
| Suscripciones SaaS con Stripe (plan Free limitado + Premium ilimitado) | Checkout + Billing Portal + webhooks |
| Protección anti-spam en el formulario de reserva | Cloudflare Turnstile + rate limiting |
| Deploy en Vercel + dominio `reservaprimero.com` | |

### Fase 2 — Mejoras post-lanzamiento
| Feature | Notas |
|---|---|
| Sincronización con Google Calendar | OAuth por staff (ver disponibilidad externa) + botón "agregar a mi calendario" para el cliente |
| Estadísticas y reportes | citas totales, facturación estimada, servicios más pedidos, tasa de asistencia |
| CRM ligero de clientes | historial de citas, notas por cliente |
| Widget embebible (botón / iFrame) para sitios externos | WordPress, Wix, sitio propio, etc. |
| Notificación interna al negocio vía Discord/Slack webhook | equivalente a lo que hace ReservaSimple con Discord |
| Reservas grupales / clases (ej. yoga, clases grupales) | si aplica a tus verticales objetivo |

### Fase 3 — Avanzado / opcional
| Feature | Notas |
|---|---|
| Cobro a clientes finales (seña o pago completo) | Stripe Connect (marketplace) — **descartado por ahora** según tu decisión, documentado para el futuro |
| Múltiples sucursales por negocio | |
| Programa de fidelización / promociones | |
| Multi-idioma | |
| Directorio público de negocios en `reservaprimero.com` | tipo marketplace |
| App nativa / PWA | tu perfil ya es iOS/Swift — podría ser un proyecto aparte más adelante |

## 8. Sistema de notificaciones (Email + WhatsApp)

- **Email**: Resend. Templates para confirmación, recordatorio y cancelación.
- **WhatsApp**: Twilio WhatsApp Business API. Requiere registrar un número de WhatsApp Business y una plantilla de mensaje aprobada por Meta para mensajes fuera de la ventana de 24h (las confirmaciones/recordatorios normalmente cuentan como "template messages").
- **Recordatorios programados**: Vercel Cron ejecuta un job periódico (ej. cada 15-30 min) que revisa citas próximas y dispara recordatorios según reglas configurables (ej. 24h antes, 2h antes).
- Registrar cada envío en `notifications_log` para trazabilidad y para evitar duplicados/reintentos.

## 9. Suscripciones y cobros (Stripe — SaaS al negocio)

- Stripe **Subscriptions** estándar (no Connect, ya que el pago es del negocio hacia ti, no hacia clientes finales).
- Al menos 2 planes: `Free` (límite de reservas/mes, ej. 30) y `Premium` (ilimitado + features avanzadas de Fase 2).
- Stripe Checkout para alta/upgrade de plan.
- Stripe Customer Portal para que el admin del negocio gestione método de pago/cancelación.
- Webhook (`/api/webhooks/stripe`) que sincroniza `subscription_status`, `plan_id` y `stripe_subscription_id` en la tabla `businesses`.
- Enforcement del límite del plan Free: al crear una cita, contar reservas del mes vigente y bloquear si excede el límite (mostrar upsell a Premium).

## 10. Seguridad y anti-spam

- Cloudflare Turnstile en el formulario público de reserva.
- Rate limiting por IP en el API route de creación de citas.
- Validaciones server-side siempre (nunca confiar solo en el cliente): disponibilidad real, límites de plan, formato de teléfono/email.
- RLS en Supabase como capa de seguridad de datos, no solo la lógica de la app.
- Tokens de cancelación/reagendado firmados y de un solo uso o con expiración.

## 11. Estructura sugerida del proyecto (Next.js App Router)

```
app/
  (marketing)/            → landing de reservaprimero.com, precios, registro de negocio
  [slug]/                 → página pública de reserva de cada negocio
  (admin)/dashboard/      → panel del admin de negocio (protegido)
  (staff)/dashboard/      → panel de staff (protegido)
  (superadmin)/dashboard/ → panel de superadmin (protegido)
  api/
    webhooks/stripe/
    webhooks/whatsapp/    → (opcional, respuestas entrantes)
    cron/reminders/
    appointments/
lib/
  supabase/               → clients (server/client), helpers RLS
  stripe/
  notifications/          → email + whatsapp senders
  availability/           → cálculo de horarios disponibles
components/
  ui/                     → shadcn
  booking/
  dashboard/
```

## 12. Infraestructura y deploy

1. Repo en GitHub, conectado a Vercel (deploy automático por rama/PR).
2. Proyecto Supabase (Postgres + Auth + RLS).
3. DNS: en Cloudflare, apuntar `reservaprimero.com` (A/CNAME) hacia Vercel; agregar el dominio en el proyecto de Vercel.
4. Entornos: `development` (local, Supabase local o proyecto de staging), `production`.
5. Variables de entorno configuradas en Vercel (ver sección 13).

## 13. Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

RESEND_API_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

NEXT_PUBLIC_APP_URL=https://reservaprimero.com
CRON_SECRET=
```

## 14. Roadmap de desarrollo (checklist por fases para Claude Code)

### Fase 0 — Setup
- [X] Inicializar proyecto Next.js (App Router, TypeScript, Tailwind, shadcn/ui)
- [~] Configurar proyecto Supabase + conectar CLI — scaffold `supabase/` + `config.toml` listos; falta `supabase link` + `db push` contra el proyecto hosted de Carlos
- [X] Definir esquema de base de datos (migraciones SQL) según sección 5
- [X] Configurar RLS policies por tabla
- [~] Configurar Vercel + GitHub + variables de entorno — `.env.example` completo; falta crear repo GitHub, conectar a Vercel y pegar env vars (acciones de Carlos)

### Fase 1 — MVP
- [X] Auth (Supabase Auth) + tabla `profiles` + middleware de roles — `proxy.ts` (Next 16), DAL `requireRole`, login/registro/logout, paneles `/dashboard` `/staff` `/superadmin`. Rutas: prefijo por rol.
- [X] CRUD negocios (alta de negocio + slug único) — `/onboarding` (crea `businesses` + enlaza `profiles.business_id` con service_role), `/dashboard/configuracion` (editar datos vía RLS), validación de slug en vivo. Nota: nuevos negocios entran como `trial` (14 días, plan Free) — ajustable en `lib/businesses/constants.ts`.
- [X] CRUD servicios por negocio — `/dashboard/servicios` (+ `/nuevo`, `/[id]`): listar/crear/editar/activar-desactivar/eliminar vía RLS `services_admin_write`.
- [X] CRUD staff + horarios (`availability_rules`, `availability_exceptions`) — `/dashboard/staff` (CRUD + `staff_services` + invitación por email → rol `staff` + panel) y `/dashboard/staff/[id]/horario` (franjas semanales + excepciones).
- [X] Lógica de cálculo de disponibilidad (sin doble-booking, con constraint en DB) — `lib/availability/` (`computeAvailability` puro + `getSlots` server-side). Constraint `EXCLUDE gist` desde Fase 0. Parámetros por negocio en Configuración (antelación, horizonte, intervalo).
- [~] Página pública de reserva `/[slug]` (flujo completo descrito en sección 6) — HECHO: flujo servicio→staff→slot→datos→confirmación, `createBooking` server-side con revalidación + find-or-create de customer + cancel_token + `auto_confirm_bookings`. PENDIENTE (sus propios bloques): Turnstile, rate limiting, límite plan Free, notificaciones.
- [X] Cancelación/reagendado vía token sin login — `/reservas/[token]`: ver / cancelar / reagendar respetando `cancellation_notice_hours`; el `cancel_token` rota al reagendar.
- [~] Dashboard admin de negocio (calendario + CRUDs + configuración) — HECHO: CRUDs (servicios, staff, horarios), configuración, y agenda de citas `/dashboard/citas` (día/semana, acciones de estado). Nav lateral pendiente de pulir.
- [ ] Dashboard staff (solo sus citas)
- [ ] Dashboard superadmin (negocios, activar/suspender, planes)
- [ ] Integración email (Resend) — confirmación + recordatorios
- [ ] Integración WhatsApp (Twilio) — confirmación + recordatorios
- [ ] Vercel Cron para recordatorios programados
- [ ] Stripe Subscriptions (Checkout, Billing Portal, webhook, enforcement de límite Free)
- [ ] Anti-spam (Turnstile + rate limiting)
- [ ] QA end-to-end + deploy a producción

### Fase 2
- [ ] Google Calendar sync (OAuth por staff)
- [ ] Estadísticas/reportes en dashboard admin
- [ ] CRM ligero de clientes
- [ ] Widget embebible
- [ ] Webhook Discord/Slack para notificación interna

### Fase 3 (opcional, evaluar más adelante)
- [ ] Stripe Connect para cobro a clientes finales
- [ ] Multi-sucursal
- [ ] Directorio público / marketplace

## 15. Cómo usar este documento con Claude Code

1. Coloca este archivo como `CLAUDE.md` en la raíz del repo — Claude Code lo carga automáticamente como contexto del proyecto.
2. Antes de arrancar, revisa la sección 7 y tacha/mueve lo que quieras excluir o reordenar.
3. Pide a Claude Code que trabaje **fase por fase** (empezando por Fase 0 y Fase 1), no todo de una vez — así puedes revisar y probar cada bloque antes de avanzar.
4. Cuando cambie algo del alcance (features cortadas, cambios de stack), actualiza este documento primero — es la fuente de verdad del proyecto.
