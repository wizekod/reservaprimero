"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setWeeklySchedule } from "@/lib/staff/schedule-actions";
import { DAYS } from "@/lib/staff/schedule";
import type { AvailabilityRuleRow } from "@/lib/staff/schedule-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Slot = { start: string; end: string };
type DayMap = Record<number, Slot[]>;

const hhmm = (t: string) => t.slice(0, 5);

function initial(rules: AvailabilityRuleRow[]): DayMap {
  const map: DayMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const r of rules) {
    map[r.day_of_week]!.push({ start: hhmm(r.start_time), end: hhmm(r.end_time) });
  }
  return map;
}

export function WeeklyScheduleEditor({
  staffId,
  rules,
}: {
  staffId: string;
  rules: AvailabilityRuleRow[];
}) {
  const [days, setDays] = useState<DayMap>(() => initial(rules));
  const [pending, startTransition] = useTransition();

  function update(day: number, next: Slot[]) {
    setDays((prev) => ({ ...prev, [day]: next }));
  }

  function save() {
    const ranges = DAYS.flatMap((d) =>
      days[d.value]!.map((s) => ({
        day_of_week: d.value,
        start: s.start,
        end: s.end,
      })),
    );
    if (ranges.some((r) => !r.start || !r.end)) {
      toast.error("Completa todas las horas.");
      return;
    }
    startTransition(async () => {
      const res = await setWeeklySchedule(staffId, ranges);
      toast[res.ok ? "success" : "error"](
        res.ok ? "Horario guardado." : res.error ?? "Error",
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario semanal</CardTitle>
        <CardDescription>
          Franjas en las que este profesional atiende cada semana.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {DAYS.map((d) => {
          const slots = days[d.value]!;
          return (
            <div key={d.value} className="grid gap-2 sm:grid-cols-[7rem_1fr]">
              <span className="pt-2 text-sm font-medium">{d.label}</span>
              <div className="grid gap-2">
                {slots.length === 0 ? (
                  <span className="pt-2 text-sm text-muted-foreground">
                    Cerrado
                  </span>
                ) : null}
                {slots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={s.start}
                      onChange={(e) =>
                        update(
                          d.value,
                          slots.map((x, j) =>
                            j === i ? { ...x, start: e.target.value } : x,
                          ),
                        )
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={s.end}
                      onChange={(e) =>
                        update(
                          d.value,
                          slots.map((x, j) =>
                            j === i ? { ...x, end: e.target.value } : x,
                          ),
                        )
                      }
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(
                          d.value,
                          slots.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update(d.value, [
                        ...slots,
                        { start: "09:00", end: "18:00" },
                      ])
                    }
                  >
                    Añadir franja
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar horario"}
        </Button>
      </CardFooter>
    </Card>
  );
}
