import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarOff,
  PlusCircle,
  Scissors,
  Users,
} from "lucide-react";

import { getProfile } from "@/lib/auth/dal";
import { getMyBusiness } from "@/lib/businesses/queries";
import { listAppointments } from "@/lib/appointments/queries";
import { addDays, todayInTz, wallTimeToInstant } from "@/lib/availability/tz";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/appointments/status";
import { clientEnv } from "@/lib/env";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = { title: "Inicio · ReservaPrimero" };

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  trial: { label: "Prueba", cls: "bg-amber-500/15 text-amber-700" },
  active: { label: "Activo", cls: "bg-emerald-500/15 text-emerald-700" },
  suspended: { label: "Suspendido", cls: "bg-destructive/15 text-destructive" },
};

const TILES = [
  {
    href: "/dashboard/nueva-reserva",
    label: "Nueva reserva",
    desc: "Agenda una cita a mano",
    icon: PlusCircle,
  },
  {
    href: "/dashboard/calendario",
    label: "Calendario",
    desc: "Día, semana y mes",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/servicios",
    label: "Servicios",
    desc: "Lo que se puede reservar",
    icon: Scissors,
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    desc: "Equipo y horarios",
    icon: Users,
  },
  {
    href: "/dashboard/bloquear-horario",
    label: "Bloquear horario",
    desc: "Feriados y días libres",
    icon: CalendarOff,
  },
];

export default async function DashboardPage() {
  const [profile, business] = await Promise.all([getProfile(), getMyBusiness()]);
  if (!business) return null;

  const tz = business.timezone;
  const today = todayInTz(tz);
  const fromISO = wallTimeToInstant(today, "00:00", tz).toISOString();
  const toISO = wallTimeToInstant(addDays(today, 1), "00:00", tz).toISOString();
  const todays = await listAppointments(fromISO, toISO);
  const active = todays.filter(
    (a) => a.status === "confirmed" || a.status === "pending",
  );

  const host = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;
  const publicUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/${business.slug}`;
  const STATUS = STATUS_STYLES[business.status] ?? {
    label: business.status,
    cls: "bg-muted text-muted-foreground",
  };
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {active.length === 0
            ? "No tienes citas para hoy."
            : `Tienes ${active.length} cita${active.length === 1 ? "" : "s"} hoy.`}
        </p>
      </div>

      {/* Enlace público */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Tu página de reservas</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS.cls}`}
            >
              {STATUS.label}
            </span>
          </div>
          <p className="truncate font-medium">
            {host}/{business.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton value={publicUrl} label="Copiar enlace" />
          <Link
            href={`/${business.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Abrir
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Hoy */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Hoy</h2>
          <Link
            href="/dashboard/calendario"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver calendario
          </Link>
        </div>
        {todays.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin citas para hoy.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {todays.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="w-12 shrink-0 text-sm font-medium tabular-nums">
                  {time(a.startAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {a.customerName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.serviceName} · {a.staffName}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}
                >
                  {STATUS_LABEL[a.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Accesos rápidos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card-hover rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <t.icon className="size-5" />
            </div>
            <p className="mt-3 font-medium">{t.label}</p>
            <p className="text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
