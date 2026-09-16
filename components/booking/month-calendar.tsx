"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { addDays, addMonths, dayOfWeek } from "@/lib/availability/tz";
import { Button } from "@/components/ui/button";
import { capitalizeFirst, cn, hexA } from "@/lib/utils";

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function daysInMonth(monthFirst: string): number {
  const [y, m] = monthFirst.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** Encabezado del calendario: "Septiembre de 2026". */
const monthLabel = (monthFirst: string) =>
  capitalizeFirst(
    new Date(`${monthFirst}T12:00:00Z`).toLocaleDateString("es", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  );

/**
 * Calendario del mes para elegir día. Lo comparten la página pública de
 * reservas y la de reagendar, para que el cliente vea lo mismo en los dos
 * sitios.
 *
 * Los días en color son los que el negocio admite reservar (desde hoy hasta su
 * horizonte de reservas), no los que tienen hueco libre: saber eso exigiría
 * calcular la disponibilidad de los treinta días de golpe. Los huecos reales
 * aparecen al elegir el día.
 */
export function MonthCalendar({
  month,
  onMonth,
  selected,
  minDate,
  maxDate,
  accent,
  onPick,
}: {
  /** Primer día del mes que se muestra, "YYYY-MM-01". */
  month: string;
  onMonth: (m: string) => void;
  selected: string;
  minDate: string;
  maxDate: string;
  /** Color de marca del negocio. Sin él se usa el de la app. */
  accent?: string;
  onPick: (d: string) => void;
}) {
  const inicio = addDays(month, -dayOfWeek(month));
  const celdas = Math.ceil((dayOfWeek(month) + daysInMonth(month)) / 7) * 7;
  const dias = Array.from({ length: celdas }, (_, i) => addDays(inicio, i));

  const mesAnterior = addMonths(month, -1);
  const mesSiguiente = addMonths(month, 1);
  const puedeAtras = addDays(mesAnterior, daysInMonth(mesAnterior) - 1) >= minDate;
  const puedeAdelante = mesSiguiente <= maxDate;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{monthLabel(month)}</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes anterior"
            disabled={!puedeAtras}
            onClick={() => onMonth(mesAnterior)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes siguiente"
            disabled={!puedeAdelante}
            onClick={() => onMonth(mesSiguiente)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {DOW.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const delMes = d.slice(0, 7) === month.slice(0, 7);
          const reservable = delMes && d >= minDate && d <= maxDate;
          const elegido = d === selected;
          return (
            <button
              key={d}
              type="button"
              disabled={!reservable}
              onClick={() => onPick(d)}
              aria-current={elegido ? "date" : undefined}
              className={cn(
                "aspect-square rounded-lg text-sm font-medium tabular-nums transition-colors",
                !delMes
                  ? "invisible"
                  : elegido
                    ? "text-white"
                    : reservable
                      ? "hover:brightness-95"
                      : "bg-muted/60 text-muted-foreground/60",
              )}
              style={
                elegido
                  ? { backgroundColor: accent ?? "var(--primary)" }
                  : reservable
                    ? accent
                      ? { backgroundColor: hexA(accent, 0.12), color: accent }
                      : { backgroundColor: "var(--primary)", color: "white" }
                    : undefined
              }
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Rejilla de horas libres, con el mismo aspecto en reserva y reagendado. */
export function SlotGrid({
  slots,
  label,
  onPick,
  disabled,
}: {
  slots: string[];
  label: (iso: string) => string;
  onPick: (iso: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {slots.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-xl bg-muted py-3 text-sm font-medium tabular-nums transition-colors hover:bg-accent disabled:opacity-50"
        >
          {label(s)}
        </button>
      ))}
    </div>
  );
}
