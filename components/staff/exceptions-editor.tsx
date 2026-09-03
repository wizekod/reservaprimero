"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addException,
  deleteException,
} from "@/lib/staff/schedule-actions";
import type { AvailabilityExceptionRow } from "@/lib/staff/schedule-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const hhmm = (t: string) => t.slice(0, 5);

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ExceptionsEditor({
  staffId,
  exceptions,
}: {
  staffId: string;
  exceptions: AvailabilityExceptionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [closed, setClosed] = useState(true);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("14:00");

  function add() {
    startTransition(async () => {
      const res = await addException(staffId, {
        date,
        is_closed: closed,
        start: closed ? "" : start,
        end: closed ? "" : end,
      });
      if (res.ok) {
        toast.success("Excepción añadida.");
        setDate(today);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteException(staffId, id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Error");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excepciones y días libres</CardTitle>
        <CardDescription>
          Anulan el horario semanal para una fecha concreta (feriado, vacaciones,
          jornada especial).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="exc-date">Fecha</Label>
            <Input
              id="exc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={closed}
              onChange={(e) => setClosed(e.target.checked)}
            />
            Cerrado todo el día
          </label>
        </div>

        {!closed ? (
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
        ) : null}

        <div>
          <Button type="button" onClick={add} disabled={pending}>
            {pending ? "Guardando…" : "Añadir excepción"}
          </Button>
        </div>

        {exceptions.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {exceptions.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  {fmtDate(e.date)} —{" "}
                  {e.is_closed
                    ? "Cerrado"
                    : e.start_time && e.end_time
                      ? `${hhmm(e.start_time)}–${hhmm(e.end_time)}`
                      : "Horario especial"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(e.id)}
                  disabled={pending}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
