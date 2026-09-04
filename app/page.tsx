import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

const features = [
  {
    icon: CalendarCheck,
    title: "Página de reservas propia",
    body: "Tus clientes reservan en reservoprimero.com/tu-negocio. Sin apps, sin llamadas, sin crear cuenta.",
  },
  {
    icon: Clock,
    title: "Disponibilidad en tiempo real",
    body: "Horarios por profesional, duración y descansos entre citas. Nunca dos reservas en el mismo hueco.",
  },
  {
    icon: Users,
    title: "Equipo y calendarios",
    body: "Cada profesional con su horario y sus servicios. Panel propio para ver solo sus citas.",
  },
  {
    icon: MessageSquare,
    title: "Recordatorios automáticos",
    body: "Confirmación y recordatorios por email y WhatsApp. Menos ausencias, menos huecos.",
  },
  {
    icon: ShieldCheck,
    title: "Cancela y reagenda sin fricción",
    body: "Cada reserva lleva un enlace para que el cliente la gestione solo, respetando tus reglas.",
  },
  {
    icon: Sparkles,
    title: "Listo en minutos",
    body: "Crea tu negocio, añade servicios y equipo, comparte el enlace. Empiezas a recibir reservas hoy.",
  },
];

const steps = [
  { n: "01", t: "Crea tu negocio", d: "Nombre, enlace, zona horaria y tus reglas de reserva." },
  { n: "02", t: "Añade servicios y equipo", d: "Duración, precio y el horario de cada profesional." },
  { n: "03", t: "Comparte tu enlace", d: "Tus clientes eligen servicio, profesional y hora." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="font-semibold tracking-tight">ReservaPrimero</span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Iniciar sesión
            </Link>
            <Link href="/registro" className={buttonVariants({ size: "sm" })}>
              Empezar gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-aurora">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="size-3.5 text-primary" />
            Agenda online para negocios de servicios
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Tus clientes reservan solos,{" "}
            <span className="text-gradient">tú te dedicas a atender</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            La página de reservas para barberías, salones, spas y consultas. Sin
            llamadas, sin cuadernos, sin dobles reservas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/registro"
              className={buttonVariants({ size: "lg" })}
            >
              Crea tu página de reservas
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            14 días de prueba · sin tarjeta
          </p>

          {/* Mock de la tarjeta de reserva */}
          <div className="mx-auto mt-14 max-w-md rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-primary/10">
            <div className="rounded-xl bg-muted/50 p-5 text-left">
              <p className="text-xs font-medium text-muted-foreground">
                reservoprimero.com/barberiajuanito
              </p>
              <p className="mt-3 font-semibold">Elige día y hora</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {["10:00", "10:45", "11:30", "12:15", "13:00", "16:00", "16:45", "17:30"].map(
                  (t, i) => (
                    <span
                      key={t}
                      className={`rounded-lg border px-2 py-1.5 text-center text-xs ${
                        i === 3
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-4 h-9 rounded-lg bg-primary/90" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          Todo lo que necesita tu agenda
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-hover rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            En tres pasos
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <span className="text-sm font-semibold text-primary">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          Empieza a recibir reservas hoy
        </h2>
        <p className="mt-3 text-muted-foreground">
          Configúralo en minutos y comparte tu enlace.
        </p>
        <Link
          href="/registro"
          className={`mt-6 inline-flex ${buttonVariants({ size: "lg" })}`}
        >
          Crear mi negocio
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} ReservaPrimero</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="hover:text-foreground">
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
