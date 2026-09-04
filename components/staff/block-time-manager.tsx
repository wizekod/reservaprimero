"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff } from "lucide-react";

import { blockTime, deleteException } from "@/lib/staff/schedule-actions";
import type { BusinessException } from "@/lib/staff/schedule-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const hhmm = (t: string) => t.slice(0, 5);

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function BlockTimeManager({
  staff,
  exceptions,
  today,
}: {
  staff: { id: string; name: string }[];
  exceptions: BusinessException[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [staffId, setStaffId] = useState<string>("all");
  const [date, setDate] = useState(today);
  const [closed, setClosed] = useState(true);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("14:00");

  function submit() {
    startTransition(async () => {
      const res = await blockTime(staffId, {
        date,
        is_closed: closed,
        start: closed ? "" : start,
        end: closed ? "" : end,
      });
      if (res.ok) {
        toast.success(
          res.skipped
            ? `Bloqueo guardado (${res.skipped} ya existían).`
            : "Bloqueo guardado.",
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  function remove(e: BusinessException) {
    startTransition(async () => {
      const res = await deleteException(e.staff_member_id, e.id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Error");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Formulario */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Nuevo bloqueo</h2>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="staff">Profesional</Label>
            <select
              id="staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">Todo el equipo</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={closed}
              onChange={(e) => setClosed(e.target.checked)}
            />
            Cerrado todo el día
          </label>

          {!closed ? (
            <div className="grid gap-1.5">
              <Label>Horario disponible ese día</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-32"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Fuera de esa franja no se podrá reservar ese día.
              </p>
            </div>
          ) : null}

          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Bloquear"}
          </Button>
        </div>
      </section>

      {/* Listado */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Bloqueos próximos</h2>
        {exceptions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <CalendarOff className="mx-auto mb-2 size-6 opacity-50" />
            No hay bloqueos programados.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {exceptions.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium capitalize">
                    {fmtDate(e.date)}
                  </p>
                  <p className="text-muted-foreground">
                    {e.staffName} ·{" "}
                    {e.is_closed
                      ? "Cerrado todo el día"
                      : e.start_time && e.end_time
                        ? `Solo ${hhmm(e.start_time)}–${hhmm(e.end_time)}`
                        : "Horario especial"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(e)}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
