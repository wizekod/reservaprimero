"use client";

import { useRouter } from "next/navigation";

import { addDays } from "@/lib/availability/tz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AgendaNav({
  date,
  view,
  rangeLabel,
  today,
  basePath,
}: {
  date: string;
  view: "dia" | "semana";
  rangeLabel: string;
  today: string;
  basePath: string;
}) {
  const router = useRouter();
  const go = (d: string, v: "dia" | "semana") =>
    router.push(`${basePath}?d=${d}&v=${v}`);

  const step = view === "semana" ? 7 : 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => go(addDays(date, -step), view)}
        >
          ‹
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
          size="sm"
          onClick={() => go(addDays(date, step), view)}
        >
          ›
        </Button>
        <span className="ml-2 text-sm font-medium capitalize">{rangeLabel}</span>
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border text-sm">
        {(["dia", "semana"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => go(date, v)}
            className={cn(
              "px-3 py-1.5",
              view === v ? "bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {v === "dia" ? "Día" : "Semana"}
          </button>
        ))}
      </div>
    </div>
  );
}
