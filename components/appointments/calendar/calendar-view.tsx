"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { AgendaAppointment, StaffOption } from "@/lib/appointments/queries";
import {
  APPOINTMENT_STATUSES,
  STATUS_BADGE,
  STATUS_BLOCK,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_STRIPE,
} from "@/lib/appointments/status";
import { addDays, addMonths, zonedDateAndMinutes } from "@/lib/availability/tz";
import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/storage/media";
import { capitalizeFirst, cn, hexA } from "@/lib/utils";

export type CalendarView = "dia" | "semana" | "mes";

/**
 * El relleno del bloque identifica al PROFESIONAL y la franja izquierda el
 * ESTADO (clase `STATUS_STRIPE`). Como el color del profesional es un hex
 * guardado en la base, tiene que ir por `style`; sólo se tiñen tres lados
 * para no pisar la franja.
 *
 * Una cita cancelada renuncia al color del profesional: si no, se confundiría
 * con una activa suya.
 */
function blockTint(a: AgendaAppointment): {
  className: string;
  style: CSSProperties;
} {
  if (a.status === "cancelled" || !a.staffColor) {
    return { className: STATUS_BLOCK[a.status], style: {} };
  }
  const borde = hexA(a.staffColor, 0.45);
  return {
    className: "text-foreground",
    style: {
      backgroundColor: hexA(a.staffColor, 0.16),
      borderTopColor: borde,
      borderRightColor: borde,
      borderBottomColor: borde,
    },
  };
}

const HOUR_PX = 56;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

type Placed = {
  appt: AgendaAppointment;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

/** Reparte en carriles las citas que se solapan dentro de un mismo día. */
function layoutDay(
  items: { appt: AgendaAppointment; start: number; end: number }[],
): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Placed[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned: number[] = [];
    cluster.forEach((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.end);
      } else {
        laneEnds[lane] = it.end;
      }
      assigned.push(lane);
    });
    cluster.forEach((it, i) =>
      out.push({ ...it, lane: assigned[i]!, lanes: laneEnds.length }),
    );
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length > 0 && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function CalendarView({
  basePath,
  view,
  date,
  today,
  timeZone,
  days,
  appointments,
  staff,
  rangeLabel,
  monthAnchor,
}: {
  basePath: string;
  view: CalendarView;
  date: string;
  today: string;
  timeZone: string;
  days: string[];
  appointments: AgendaAppointment[];
  staff: StaffOption[];
  rangeLabel: string;
  monthAnchor: string;
}) {
  const router = useRouter();
  const [staffId, setStaffId] = useState<string>("all");
  // Se guarda el id, no la cita: así el panel de detalle refleja el estado
  // actualizado cuando router.refresh() vuelve a traer las citas.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const go = (d: string, v: CalendarView) =>
    router.push(`${basePath}?d=${d}&v=${v}`);

  const step = (dir: 1 | -1) => {
    if (view === "mes") return go(addMonths(monthAnchor, dir), view);
    return go(addDays(date, dir * (view === "semana" ? 7 : 1)), view);
  };

  const selected = useMemo(
    () => appointments.find((a) => a.id === selectedId) ?? null,
    [appointments, selectedId],
  );

  const visible = useMemo(
    () =>
      staffId === "all"
        ? appointments
        : appointments.filter((a) => a.staffMemberId === staffId),
    [appointments, staffId],
  );

  /** Citas agrupadas por fecha local, con minutos desde medianoche. */
  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { appt: AgendaAppointment; start: number; end: number }[]
    >();
    for (const a of visible) {
      const s = zonedDateAndMinutes(a.startAt, timeZone);
      const e = zonedDateAndMinutes(a.endAt, timeZone);
      const end = e.date === s.date ? e.minutes : 24 * 60;
      const list = map.get(s.date) ?? [];
      list.push({ appt: a, start: s.minutes, end: Math.max(end, s.minutes + 15) });
      map.set(s.date, list);
    }
    return map;
  }, [visible, timeZone]);

  const [startHour, endHour] = useMemo(() => {
    let min = DEFAULT_START_HOUR;
    let max = DEFAULT_END_HOUR;
    for (const list of byDay.values()) {
      for (const it of list) {
        min = Math.min(min, Math.floor(it.start / 60));
        max = Math.max(max, Math.ceil(it.end / 60));
      }
    }
    return [Math.max(0, min), Math.min(24, Math.max(max, min + 4))];
  }, [byDay]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) =>
    capitalizeFirst(
      new Date(`${d}T12:00:00Z`).toLocaleDateString("es", {
        ...opts,
        timeZone: "UTC",
      }),
    );

  return (
    <div className="space-y-4">
      {/* Barra de navegación */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Anterior"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(today, view)}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Siguiente"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 truncate text-base font-semibold sm:text-lg">
            {capitalizeFirst(rangeLabel)}
          </h2>
        </div>

        <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => go(date, v)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro de profesional */}
      {staff.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Profesional</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={staffId === "all"}
              onClick={() => setStaffId("all")}
            >
              Todos
            </FilterChip>
            {staff.map((s) => (
              <FilterChip
                key={s.id}
                active={staffId === s.id}
                onClick={() => setStaffId(s.id)}
                color={s.color}
                avatarPath={s.avatarPath}
              >
                {s.name}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Leyenda: la franja izquierda de cada bloque codifica el estado */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-muted-foreground">Estado</span>
        {APPOINTMENT_STATUSES.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span className={cn("h-3 w-1 rounded-sm", STATUS_DOT[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Rejilla */}
      {view === "mes" ? (
        <MonthGrid
          days={days}
          monthAnchor={monthAnchor}
          today={today}
          byDay={byDay}
          onPickDay={(d) => go(d, "dia")}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div
            className={cn(
              "flex min-w-full",
              view === "semana" ? "min-w-[46rem]" : "",
            )}
          >
            {/* Columna de horas */}
            <div className="w-14 shrink-0 border-r border-border">
              <div className="h-10 border-b border-border" />
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                    style={{ top: (h - startHour) * HOUR_PX }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
            </div>

            {/* Columnas de días */}
            {days.map((d) => {
              const placed = layoutDay(byDay.get(d) ?? []);
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className="min-w-0 flex-1 border-r border-border last:border-r-0"
                >
                  <div
                    className={cn(
                      "flex h-10 items-center justify-center gap-1 border-b border-border text-xs font-medium",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {view === "semana"
                      ? dayLabel(d, { weekday: "short", day: "numeric" })
                      : dayLabel(d, { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  <div
                    className={cn("relative", isToday && "bg-primary/[0.03]")}
                    style={{ height: gridHeight }}
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-border/60"
                        style={{ top: (h - startHour) * HOUR_PX }}
                      />
                    ))}
                    {placed.map((p) => {
                      const top = (p.start - startHour * 60) * (HOUR_PX / 60);
                      const height = Math.max(
                        (p.end - p.start) * (HOUR_PX / 60) - 2,
                        20,
                      );
                      const tint = blockTint(p.appt);
                      return (
                        <button
                          key={p.appt.id}
                          type="button"
                          title={`${p.appt.staffName} · ${STATUS_LABEL[p.appt.status]} · ${p.appt.serviceName}`}
                          onClick={() => setSelectedId(p.appt.id)}
                          className={cn(
                            "absolute overflow-hidden rounded-md border border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow hover:shadow-md",
                            STATUS_STRIPE[p.appt.status],
                            tint.className,
                          )}
                          style={{
                            ...tint.style,
                            top,
                            height,
                            left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                            width: `calc(${100 / p.lanes}% - 4px)`,
                          }}
                        >
                          <span className="block truncate font-medium">
                            {hhmm(p.start)} {p.appt.customerName}
                          </span>
                          {height >= 36 ? (
                            <span className="block truncate opacity-80">
                              {p.appt.serviceName}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected ? (
        <DetailSheet
          appt={selected}
          timeZone={timeZone}
          customerHref={
            basePath.startsWith("/dashboard") ? "/dashboard/clientes" : null
          }
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Además de filtrar, estos chips hacen de leyenda de profesionales: la muestra
 * de color es la misma con la que se tiñen sus citas en la rejilla.
 */
function FilterChip({
  active,
  onClick,
  color,
  avatarPath,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string | null;
  avatarPath?: string | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {avatarPath ? (
        <Avatar src={mediaUrl(avatarPath)} name="" className="size-4" />
      ) : color ? (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {children}
    </button>
  );
}

function MonthGrid({
  days,
  monthAnchor,
  today,
  byDay,
  onPickDay,
}: {
  days: string[];
  monthAnchor: string;
  today: string;
  byDay: Map<string, { appt: AgendaAppointment; start: number; end: number }[]>;
  onPickDay: (d: string) => void;
}) {
  const month = monthAnchor.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <span
            key={d}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const inMonth = d.slice(0, 7) === month;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "min-h-20 border-b border-r border-border p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-accent/50 sm:min-h-28",
                !inMonth && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {Number(d.slice(8))}
              </span>
              <span className="mt-1 hidden space-y-0.5 sm:block">
                {/* Mismo lenguaje que la rejilla: punto = profesional,
                    franja izquierda = estado. */}
                {items.slice(0, 2).map((it) => (
                  <span
                    key={it.appt.id}
                    title={`${it.appt.staffName} · ${STATUS_LABEL[it.appt.status]}`}
                    className={cn(
                      "flex items-center gap-1 truncate border-l-2 px-1 text-[10px]",
                      STATUS_STRIPE[it.appt.status],
                      it.appt.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        it.appt.staffColor ? "" : STATUS_DOT[it.appt.status],
                      )}
                      style={
                        it.appt.staffColor
                          ? { backgroundColor: it.appt.staffColor }
                          : undefined
                      }
                    />
                    <span className="truncate">
                      {hhmm(it.start)} {it.appt.customerName}
                    </span>
                  </span>
                ))}
                {items.length > 2 ? (
                  <span className="block px-1 text-[10px] text-muted-foreground">
                    +{items.length - 2} más
                  </span>
                ) : null}
              </span>
              {items.length > 0 ? (
                <span className="mt-1 block text-[10px] font-medium text-primary sm:hidden">
                  {items.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailSheet({
  appt,
  timeZone,
  customerHref,
  onClose,
}: {
  appt: AgendaAppointment;
  timeZone: string;
  customerHref: string | null;
  onClose: () => void;
}) {
  const when = capitalizeFirst(
    new Date(appt.startAt).toLocaleString("es", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>

        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[appt.status]}`}
        >
          {STATUS_LABEL[appt.status]}
        </span>
        <h3 className="mt-2 text-lg font-semibold">{appt.serviceName}</h3>
        <p className="text-sm text-muted-foreground">{when}</p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <Row
            label="Cliente"
            value={
              // Sólo el panel del negocio tiene ficha de cliente; el de staff
              // reusa este mismo calendario y no debe enlazar ahí.
              customerHref && appt.customerId ? (
                <Link
                  href={`${customerHref}/${appt.customerId}`}
                  className="underline underline-offset-4"
                >
                  {appt.customerName}
                </Link>
              ) : (
                appt.customerName
              )
            }
          />
          {appt.customerPhone ? (
            <Row label="Teléfono" value={appt.customerPhone} />
          ) : null}
          <Row
            label="Profesional"
            value={
              <span className="inline-flex items-center gap-1.5">
                {appt.staffColor ? (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: appt.staffColor }}
                  />
                ) : null}
                {appt.staffName}
              </span>
            }
          />
          {appt.notes ? <Row label="Nota" value={appt.notes} /> : null}
        </dl>

        <div className="mt-4 border-t border-border pt-3">
          <AppointmentActions id={appt.id} status={appt.status} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}
