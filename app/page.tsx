import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Check, ChevronDown, ChevronRight, Zap } from "lucide-react";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/landing/brand-icons";
import { Logo } from "@/components/landing/logo";
import {
  ChannelsVisual,
  ConfirmedScreen,
  CustomerVisual,
  DigestVisual,
  HeroVisual,
  InstagramScreen,
  LockScreen,
  ManageVisual,
  PhoneFrame,
  QrScreen,
  RemindersVisual,
  StatsVisual,
  TeamCalendarVisual,
} from "@/components/landing/mockups";
import { SiteHeader } from "@/components/landing/site-header";
import { SlugCta } from "@/components/landing/slug-cta";

export const metadata: Metadata = {
  title: "ReservaPrimero · Agenda de citas online para tu negocio",
  description:
    "Tus clientes reservan solos desde tu enlace, reciben confirmación y recordatorios por WhatsApp y pueden cancelar o reagendar sin escribirte.",
};

// Los precios salen de la tabla de planes: se refrescan cada hora.
export const revalidate = 3600;

type Plan = Pick<
  Database["public"]["Tables"]["subscription_plans"]["Row"],
  "name" | "price" | "monthly_booking_limit" | "features"
>;

async function getPlans(): Promise<Plan[]> {
  // Cliente anónimo sin cookies para que la página siga siendo estática.
  const supabase = createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabase
    .from("subscription_plans")
    .select("name, price, monthly_booking_limit, features")
    .order("price");
  // Primero el plan con límite (Gratis) y después el ilimitado.
  return (data ?? []).sort(
    (a, b) => Number(a.monthly_booking_limit == null) - Number(b.monthly_booking_limit == null),
  );
}

const VERTICALS: { label: string; className: string }[] = [
  { label: "Barberías", className: "font-heading font-bold tracking-[0.18em] uppercase" },
  { label: "Salones de belleza", className: "font-serif italic" },
  { label: "Spas", className: "font-serif tracking-wide" },
  { label: "nails & lashes", className: "font-sans font-medium" },
  { label: "CONSULTORIOS", className: "font-sans tracking-[0.25em]" },
  { label: "Tatuajes", className: "font-heading font-extrabold italic" },
  { label: "Yoga & Pilates", className: "font-serif" },
];

const CHECKLIST: { title: string; items: string[] }[] = [
  {
    title: "Gestión de citas",
    items: [
      "Página de reservas con tu enlace",
      "Calendario por día, semana y mes",
      "Recordatorios por WhatsApp",
      "Recordatorios por email",
      "Confirmación automática",
      "Reagendar y cancelar por enlace",
      "Nueva reserva desde el panel",
      "Bloquear horarios",
    ],
  },
  {
    title: "Tu equipo",
    items: [
      "Varios profesionales",
      "Horario propio para cada uno",
      "Servicios por profesional",
      "Panel propio para cada profesional",
      "Color y foto por profesional",
      "Resumen diario de agenda",
    ],
  },
  {
    title: "Tus clientes",
    items: [
      "Ficha de cada cliente",
      "Historia clínica privada",
      "Historial de citas",
      "Reconocemos al cliente por su teléfono",
      "Código QR para tu local",
      "Estadísticas de asistencia",
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Mis clientes tienen que descargar algo?",
    a: "No. Reservan desde el navegador del celular o la computadora, en tu enlace, sin crear cuenta ni contraseña.",
  },
  {
    q: "¿Cómo llegan los recordatorios?",
    a: "Por email y, en el plan Premium, también por WhatsApp. Salen solos 24 horas y 2 horas antes de cada cita.",
  },
  {
    q: "¿Puedo tener varios profesionales?",
    a: "Sí. Cada uno tiene sus horarios, sus servicios y su propio panel, donde ve sólo sus citas.",
  },
  {
    q: "¿Se pueden empalmar dos citas?",
    a: "No. Antes de confirmar comprobamos que el horario sigue libre para ese profesional, también si dos personas reservan a la vez.",
  },
  {
    q: "¿Puedo bloquear horarios?",
    a: "Sí: vacaciones, días festivos o un hueco puntual. Esos horarios dejan de aparecer en tu página.",
  },
  {
    q: "¿Puedo agendar citas yo mismo?",
    a: "Sí. Si un cliente te llama o te escribe, la registras desde el panel y recibe la misma confirmación.",
  },
  {
    q: "¿Cómo cancela o reagenda un cliente?",
    a: "Con el enlace que le llega en la confirmación, respetando la anticipación mínima que tú definas.",
  },
  {
    q: "¿Cobran comisión por reserva?",
    a: "No. Pagas sólo tu plan. Tus clientes te pagan a ti, en efectivo o por transferencia, como siempre.",
  },
  {
    q: "¿Qué pasa si llego al límite del plan Gratis?",
    a: "Tu página deja de aceptar reservas nuevas hasta el mes siguiente. Si pasas a Premium, no hay límite.",
  },
  {
    q: "¿Cómo empiezo?",
    a: "Crea tu cuenta, elige tu enlace, añade servicios y horarios, y compártelo. En unos minutos puedes recibir reservas.",
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
      <span className="hidden h-px flex-1 bg-border sm:block" />
      <span className="mx-auto max-w-md text-center sm:mx-0 sm:max-w-none">{children}</span>
      <span className="hidden h-px flex-1 bg-border sm:block" />
    </div>
  );
}

function FeatureRow({
  badge,
  title,
  subtitle,
  body,
  visual,
  reverse,
}: {
  badge?: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="rounded-[2rem] bg-muted/70 px-6 py-14 sm:px-12 lg:py-20">
      <div
        className={cn(
          "grid items-center gap-12 lg:grid-cols-2",
          reverse && "lg:[&>*:first-child]:order-2",
        )}
      >
        <div>{visual}</div>
        <div className="max-w-md">
          {badge}
          <h3 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
            {title}
            <span className="block text-muted-foreground">{subtitle}</span>
          </h3>
          <p className="mt-4 text-lg text-muted-foreground">{body}</p>
          <Link
            href="/registro"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Empezar gratis <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const plans = await getPlans();
  const host = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;

  const carousel = [
    {
      title: "Reservas en línea",
      body: "Servicios, precios y horarios en un solo enlace. Tus clientes eligen día, hora y profesional.",
      screen: <ConfirmedScreen />,
    },
    {
      title: "Desde Instagram",
      body: "Pon tu enlace en la bio y recibe reservas de quien ya te sigue.",
      screen: <InstagramScreen host={host} />,
    },
    {
      title: "Código QR",
      body: "Descárgalo listo para imprimir. Quien lo escanea en tu local llega directo a reservar.",
      screen: <QrScreen />,
    },
    {
      title: "Recordatorios",
      body: "Un aviso antes de cada cita para que nadie la olvide.",
      screen: <LockScreen />,
    },
  ];

  const moreFeatures = [
    {
      title: "Un calendario para todo tu equipo",
      body: "Cada profesional con su color, su horario y sus servicios. Ves el día, la semana o el mes de un vistazo, y cada quien entra a su propio panel.",
      visual: <TeamCalendarVisual />,
    },
    {
      title: "Conoce a tus clientes",
      body: "Ficha con su historial de citas y una historia clínica privada que sólo tú ves. Si alguien escribe su teléfono de otra forma, igual lo reconocemos.",
      visual: <CustomerVisual />,
    },
    {
      title: "Números claros",
      body: "Citas por estado, servicios más pedidos, tasa de asistencia y facturación estimada del periodo que elijas.",
      visual: <StatsVisual />,
    },
    {
      title: "Tu equipo siempre al día",
      body: "Cada profesional recibe por la mañana su agenda del día y un aviso cuando le reservan, cancelan o reagendan una cita.",
      visual: <DigestVisual />,
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-x-clip bg-background">
      <div className="bg-aurora">
        <SiteHeader />

        {/* ───────────── Hero ───────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14 lg:pb-24">
          <div className="rp-reveal">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Zap className="size-4 fill-amber-400 text-amber-400" />
                Sin comisiones por reserva
              </span>
              <span aria-hidden>·</span>
              Tus clientes no descargan nada
            </p>
            <h1 className="mt-4 font-heading text-[2.6rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Tu agenda llena,{" "}
              <span className="text-gradient">sin contestar mensajes</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground sm:text-xl">
              Tus clientes <b className="font-semibold text-foreground">reservan solos</b>, reciben
              su <b className="font-semibold text-foreground">confirmación</b> y un{" "}
              <b className="font-semibold text-foreground">recordatorio por WhatsApp</b>. Todo
              automático.
            </p>
            <div className="mt-9">
              <SlugCta host={host} />
              <p className="mt-3 pl-1 text-sm text-muted-foreground">
                Empieza gratis · sin tarjeta
              </p>
            </div>
          </div>
          <div className="rp-reveal [animation-delay:150ms]">
            <HeroVisual />
          </div>
        </section>
      </div>

      {/* ───────────── Tipos de negocio ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <SectionEyebrow>Hecho para negocios que viven de su agenda</SectionEyebrow>
        <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="rp-marquee flex w-max items-center gap-14 pr-14">
            {[...VERTICALS, ...VERTICALS].map((v, i) => (
              <span
                key={i}
                aria-hidden={i >= VERTICALS.length}
                className={cn("shrink-0 text-2xl text-muted-foreground/80", v.className)}
              >
                {v.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Bloque oscuro ───────────── */}
      <section className="px-3 sm:px-6">
        <div className="bg-ink relative mx-auto max-w-[1240px] overflow-hidden rounded-[2.5rem] px-6 py-20 text-center text-white sm:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
          />
          <h2 className="relative mx-auto max-w-4xl font-heading text-4xl font-bold tracking-tight sm:text-6xl">
            Menos mensajes, más citas confirmadas.{" "}
            <span className="text-white/60">
              Tus clientes van a querer{" "}
              <span className="text-[oklch(0.78_0.13_277)]">reservar</span> contigo.
            </span>
          </h2>
          <div className="relative mx-auto mt-16 grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/15">
            {[
              ["24/7", "Tu página recibe reservas mientras duermes o atiendes"],
              ["0 apps", "Tus clientes reservan desde el navegador, sin crear cuenta"],
              ["2 avisos", "Recordatorio 24 h y 2 h antes de cada cita"],
            ].map(([n, t]) => (
              <div key={n} className="px-6">
                <p className="font-heading text-5xl font-bold sm:text-6xl">{n}</p>
                <p className="mx-auto mt-3 max-w-[15rem] text-white/65">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Canales ───────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-24 pb-10 sm:px-6">
        <SectionEyebrow>Comparte tu enlace donde ya están tus clientes</SectionEyebrow>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 text-lg font-semibold">
          <span className="flex items-center gap-2">
            <WhatsAppIcon className="size-6 text-[#25D366]" /> WhatsApp
          </span>
          <span className="flex items-center gap-2">
            <InstagramIcon className="size-6 text-[#d62976]" /> Instagram
          </span>
          <span className="flex items-center gap-2">
            <FacebookIcon className="size-6 text-[#1877f2]" /> Facebook
          </span>
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              QR
            </span>
            En tu local
          </span>
        </div>
      </section>

      {/* ───────────── Funciones principales ───────────── */}
      <section id="funciones" className="mx-auto grid w-full max-w-[1240px] scroll-mt-24 gap-5 px-3 py-10 sm:px-6">
        <FeatureRow
          title="Un solo enlace."
          subtitle="Reservas desde todas partes."
          body="Tu página en reservaprimero.com/tu-negocio con servicios, precios y horarios disponibles en tiempo real. Sin llamadas ni mensajes de ida y vuelta."
          visual={<ChannelsVisual />}
        />
        <FeatureRow
          reverse
          badge={
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.2_0.035_274)] px-3 py-1 text-xs font-medium text-white">
              <WhatsAppIcon className="size-3.5" /> API oficial de WhatsApp
            </span>
          }
          title="Recordatorios automáticos."
          subtitle="Adiós a las citas olvidadas 👋"
          body="Confirmación al reservar y recordatorios 24 h y 2 h antes, por WhatsApp y email. Menos ausencias, menos huecos en tu día."
          visual={<RemindersVisual />}
        />
        <FeatureRow
          title="Cancelan o reagendan solos."
          subtitle="Sin escribirte."
          body="Cada reserva incluye un enlace para gestionarla, con la anticipación mínima que tú decidas. El horario liberado vuelve a estar disponible al instante."
          visual={<ManageVisual />}
        />
      </section>

      {/* ───────────── Carrusel de teléfonos ───────────── */}
      <section className="py-16">
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:px-6 lg:justify-center [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {carousel.map((c) => (
            <article
              key={c.title}
              className="relative flex h-[34rem] w-[19rem] shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] bg-muted/70 px-7 pt-8"
            >
              <h3 className="font-heading text-2xl font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-muted-foreground">{c.body}</p>
              <PhoneFrame className="mx-auto mt-auto -mb-16 h-[22rem] w-[15rem]">{c.screen}</PhoneFrame>
            </article>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/registro"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-8 py-4 text-sm font-semibold tracking-wide text-primary-foreground uppercase shadow-lg shadow-primary/30 transition-opacity hover:opacity-90"
          >
            Comenzar gratis <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ───────────── Mucho más que una agenda (tarjetas apiladas) ───────────── */}
      <section className="mx-auto w-full max-w-[1240px] px-3 pt-16 pb-24 sm:px-6">
        <div className="text-center">
          <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Mucho más que una agenda
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Herramientas para que tu negocio funcione solo
          </p>
        </div>
        <div className="mt-14 grid gap-6">
          {moreFeatures.map((f, i) => (
            <div
              key={f.title}
              className="sticky rounded-[2rem] border border-border bg-card px-6 py-12 shadow-[0_-12px_40px_-20px] shadow-primary/20 sm:px-14"
              style={{ top: `${88 + i * 24}px` }}
            >
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <div>
                  <h3 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                    {f.title}
                  </h3>
                  <p className="mt-4 max-w-md text-lg text-muted-foreground">{f.body}</p>
                </div>
                <div className="flex justify-center lg:justify-end">{f.visual}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Checklist ───────────── */}
      <section className="border-t border-border">
        {CHECKLIST.map((group) => (
          <div key={group.title} className="border-b border-border">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[18rem_1fr]">
              <h2 className="font-heading text-4xl font-medium tracking-tight">{group.title}</h2>
              <ul className="grid gap-x-12 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between gap-4 border-b border-border py-4 text-lg"
                  >
                    {item}
                    <Check className="size-4 shrink-0 text-primary" strokeWidth={3} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* ───────────── Precios ───────────── */}
      <section id="precios" className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-3 py-24 sm:px-6">
        <div className="text-center">
          <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Empieza gratis, crece con Premium
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Sin comisiones por reserva y sin contratos. Cambia de plan cuando quieras.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-2">
          {plans.map((p) => {
            const features = (p.features ?? {}) as Record<string, unknown>;
            const premium = p.monthly_booking_limit == null;
            const items = premium
              ? [
                  "Reservas ilimitadas",
                  ...(features.whatsapp === true ? ["Confirmación y recordatorios por WhatsApp"] : []),
                  "Todo lo del plan Gratis",
                ]
              : [
                  `Hasta ${p.monthly_booking_limit} reservas al mes`,
                  "Página de reservas con tu enlace y código QR",
                  "Equipo, horarios y servicios",
                  "Confirmación y recordatorios por email",
                  "Cancelar y reagendar por enlace",
                  "Clientes e historia clínica",
                ];
            const price = Number(p.price);
            return (
              <div
                key={p.name}
                className={cn(
                  "relative flex flex-col rounded-[2rem] p-8 sm:p-10",
                  premium
                    ? "bg-ink text-white shadow-2xl shadow-primary/25"
                    : "border border-border bg-card shadow-xl shadow-black/5",
                )}
              >
                {premium ? (
                  <span className="mb-4 inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                    <Zap className="size-3.5 fill-current" /> El más completo
                  </span>
                ) : (
                  <span className="mb-4 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    Para empezar
                  </span>
                )}
                <h3 className="font-heading text-2xl font-semibold">
                  {premium ? p.name : "Gratis"}
                </h3>
                <p className="mt-4 font-heading text-5xl font-bold tracking-tight">
                  {price > 0 ? (
                    <>
                      {formatPrice(price)}
                      <span className={cn("ml-2 text-lg font-medium", premium ? "text-white/60" : "text-muted-foreground")}>
                        MXN / mes
                      </span>
                    </>
                  ) : premium ? (
                    <span className="text-4xl">Próximamente</span>
                  ) : (
                    "$0"
                  )}
                </p>
                <ul className="mt-8 grid gap-3">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-3">
                      <Check
                        className={cn("mt-1 size-4 shrink-0", premium ? "text-[oklch(0.78_0.13_277)]" : "text-primary")}
                        strokeWidth={3}
                      />
                      <span className={premium ? "text-white/85" : undefined}>{it}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/registro"
                  className={cn(
                    "mt-10 inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 font-semibold transition-opacity hover:opacity-90",
                    premium ? "bg-white text-[oklch(0.2_0.035_274)]" : "bg-primary text-primary-foreground",
                  )}
                >
                  {!premium ? "Crear mi agenda gratis" : price > 0 ? "Empezar y pasar a Premium" : "Empezar gratis"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────── Preguntas frecuentes ───────────── */}
      <section id="preguntas" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <h2 className="text-center font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-12 grid items-start gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-3xl bg-card px-7 py-5 shadow-[0_8px_30px_-12px] shadow-black/10 ring-1 ring-border/60"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────────── CTA final ───────────── */}
      <section className="px-3 pb-20 sm:px-6">
        <div className="bg-ink relative mx-auto max-w-[1240px] overflow-hidden rounded-[2.5rem] px-6 py-20 text-center text-white sm:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
          />
          <h2 className="relative mx-auto max-w-3xl font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            Crea tu agenda de citas hoy
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/70">
            Empieza gratis, comparte tu enlace en WhatsApp e Instagram y pasa a Premium cuando
            quieras crecer sin límites.
          </p>
          <div className="relative mt-9 flex flex-col items-center gap-4">
            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-7 py-3.5 font-semibold text-[oklch(0.2_0.035_274)] transition-opacity hover:opacity-90"
            >
              Registrar mi negocio <ArrowRight className="size-4" />
            </Link>
            <a href="#precios" className="text-sm text-white/60 underline underline-offset-4 hover:text-white">
              Ver planes
            </a>
          </div>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto_auto]">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReservaPrimero
            </p>
          </div>
          <nav className="grid content-start gap-2.5 text-sm">
            <p className="font-semibold">Producto</p>
            <a href="#funciones" className="text-muted-foreground hover:text-foreground">Funciones</a>
            <a href="#precios" className="text-muted-foreground hover:text-foreground">Precios</a>
            <a href="#preguntas" className="text-muted-foreground hover:text-foreground">Preguntas frecuentes</a>
          </nav>
          <nav className="grid content-start gap-2.5 text-sm">
            <p className="font-semibold">Cuenta</p>
            <Link href="/registro" className="text-muted-foreground hover:text-foreground">Registrar mi negocio</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">Iniciar sesión</Link>
            <Link href="/recuperar" className="text-muted-foreground hover:text-foreground">Recuperar contraseña</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
