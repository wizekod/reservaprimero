"use client";

import { useState, useTransition } from "react";

import {
  cancelByToken,
  fetchSlotsForReschedule,
  rescheduleByToken,
} from "@/lib/booking/manage-actions";
import type { ManagedAppointment } from "@/lib/booking/manage";
import { startOfMonth } from "@/lib/availability/tz";
import { MonthCalendar, SlotGrid } from "@/components/booking/month-calendar";
import { Button } from "@/components/ui/button";
import { STATUS_BADGE } from "@/lib/appointments/status";
import { capitalizeFirst, cn } from "@/lib/utils";

const STATUS_TEXT: Record<ManagedAppointment["status"], string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  no_show: "No asististe",
};

export function ManageView({
  appt,
  minDate,
  maxDate,
}: {
  appt: ManagedAppointment;
  minDate: string;
  maxDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"summary" | "reschedule">("summary");
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState(appt.status);
  const [startAt, setStartAt] = useState(appt.startAt);
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const modifiable = appt.canModify && status === appt.status;

  const [date, setDate] = useState(minDate);
  const [month, setMonth] = useState(() => startOfMonth(minDate));
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  const dtf = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString("es", { ...opts, timeZone: appt.timeZone });
  const whenText = capitalizeFirst(
    `${dtf(startAt, { weekday: "long", day: "numeric", month: "long" })} · ${dtf(startAt, { hour: "2-digit", minute: "2-digit" })}`,
  );

  function loadSlots(d: string) {
    setSlotsLoaded(false);
    startTransition(async () => {
      const res = await fetchSlotsForReschedule(appt.token, d);
      setSlots(
        res.ok ? [...new Set(res.slots.map((s) => s.start))] : [],
      );
      setSlotsLoaded(true);
    });
  }

  function doCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelByToken(appt.token);
      if (res.ok) setStatus("cancelled");
      else setError(res.error ?? "Error");
    });
  }

  function doReschedule(newStart: string) {
    setError(null);
    startTransition(async () => {
      const res = await rescheduleByToken(appt.token, newStart);
      if (res.ok && res.startAt) {
        setStartAt(res.startAt);
        setManageUrl(res.manageUrl ?? null);
        setView("summary");
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  return (
    <div className="bg-aurora min-h-svh">
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Tu reserva en{" "}
            <span className="font-medium text-foreground">
              {appt.businessName}
            </span>
          </p>
          <h1 className="mt-1 text-lg font-semibold">
            {appt.serviceName}
          </h1>
          <p className="text-sm text-muted-foreground">{whenText}</p>
          <p className="text-sm text-muted-foreground">con {appt.staffName}</p>
          <span
            className={cn(
              "mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_BADGE[status],
            )}
          >
            {STATUS_TEXT[status]}
          </span>

          <div className="mt-4 grid gap-4">

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {manageUrl ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Nuevo enlace de gestión:
              <br />
              <span className="break-all">{manageUrl}</span>
            </p>
          ) : null}

          {status === "cancelled" ? (
            <p className="text-sm text-muted-foreground">
              Esta reserva quedó cancelada.
            </p>
          ) : !modifiable ? (
            <p className="text-sm text-muted-foreground">
              Ya no se puede modificar (fuera del plazo permitido).
            </p>
          ) : view === "summary" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setView("reschedule");
                  loadSlots(date);
                }}
                disabled={pending}
              >
                Reagendar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={doCancel}
                disabled={pending}
              >
                Cancelar reserva
              </Button>
            </div>
          ) : (
            <div className="grid gap-5">
              <MonthCalendar
                month={month}
                onMonth={setMonth}
                selected={date}
                minDate={minDate}
                maxDate={maxDate}
                accent={appt.brandColor ?? undefined}
                onPick={(d) => {
                  setDate(d);
                  loadSlots(d);
                }}
              />

              <div className="border-t border-border pt-5">
                {pending && !slotsLoaded ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Buscando horarios…
                  </p>
                ) : slotsLoaded && slots.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay horarios disponibles ese día. Prueba con otra fecha.
                  </p>
                ) : (
                  <SlotGrid
                    slots={slots}
                    label={(s) => dtf(s, { hour: "2-digit", minute: "2-digit" })}
                    onPick={doReschedule}
                    disabled={pending}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setView("summary")}
                className="justify-self-start text-sm text-muted-foreground underline underline-offset-4"
              >
                ← Atrás
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
