import type { Metadata } from "next";

import { getMyBusiness } from "@/lib/businesses/queries";
import { listAppointments } from "@/lib/appointments/queries";
import { addDays, todayInTz, wallTimeToInstant } from "@/lib/availability/tz";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Estadísticas · ReservaPrimero" };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: AppointmentStatus[] = [
  "confirmed",
  "completed",
  "pending",
  "cancelled",
  "no_show",
];

const money = (n: number) =>
  new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(n);

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const tz = business.timezone;
  const today = todayInTz(tz);
  const sp = await searchParams;
  const hasta =
    typeof sp.hasta === "string" && dateRe.test(sp.hasta) ? sp.hasta : today;
  const desde =
    typeof sp.desde === "string" && dateRe.test(sp.desde)
      ? sp.desde
      : addDays(hasta, -29);

  const fromISO = wallTimeToInstant(desde, "00:00", tz).toISOString();
  const toISO = wallTimeToInstant(addDays(hasta, 1), "00:00", tz).toISOString();
  const appointments = await listAppointments(fromISO, toISO);

  const byStatus = new Map<AppointmentStatus, number>();
  const byService = new Map<string, { count: number; revenue: number }>();
  let revenue = 0;

  for (const a of appointments) {
    byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
    const s = byService.get(a.serviceName) ?? { count: 0, revenue: 0 };
    s.count += 1;
    if (a.status === "completed") {
      s.revenue += a.servicePrice;
      revenue += a.servicePrice;
    }
    byService.set(a.serviceName, s);
  }

  const completed = byStatus.get("completed") ?? 0;
  const noShow = byStatus.get("no_show") ?? 0;
  const attendance =
    completed + noShow > 0
      ? Math.round((completed / (completed + noShow)) * 100)
      : null;

  const topServices = [...byService.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">
          Del {desde} al {hasta}.
        </p>
      </div>

      {/* Rango */}
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            max={hasta}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Aplicar
        </button>
      </form>

      {/* Tarjetas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Citas" value={String(appointments.length)} />
        <Stat label="Facturación estimada" value={money(revenue)} hint="servicios completados" />
        <Stat label="Completadas" value={String(completed)} />
        <Stat
          label="Tasa de asistencia"
          value={attendance === null ? "—" : `${attendance}%`}
          hint={attendance === null ? "sin datos aún" : `${noShow} no-show`}
        />
      </div>

      {/* Desglose por estado */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Por estado</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[s]}`}
            >
              {STATUS_LABEL[s]}: {byStatus.get(s) ?? 0}
            </span>
          ))}
        </div>
      </section>

      {/* Top servicios */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Servicios más pedidos</h2>
        {topServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin citas en este periodo.
          </p>
        ) : (
          <ul className="space-y-2">
            {topServices.map(([name, s]) => {
              const pct = Math.round((s.count / appointments.length) * 100);
              return (
                <li key={name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {s.count} · {money(s.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
