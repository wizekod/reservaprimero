import { z } from "zod";

/** 0 = domingo … 6 = sábado (convención JS getDay). Se muestra con lunes primero. */
export const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export const DAY_LABEL: Record<number, string> = Object.fromEntries(
  DAYS.map((d) => [d.value, d.label]),
);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const rangeSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    start: z.string().regex(TIME_RE, "Hora inválida"),
    end: z.string().regex(TIME_RE, "Hora inválida"),
  })
  .refine((r) => r.start < r.end, { message: "El inicio debe ser antes del fin" });

export type Range = z.infer<typeof rangeSchema>;

/** Devuelve un mensaje si hay franjas que se solapan dentro de un mismo día. */
export function findOverlap(ranges: Range[]): string | null {
  const byDay = new Map<number, Range[]>();
  for (const r of ranges) {
    const list = byDay.get(r.day_of_week) ?? [];
    list.push(r);
    byDay.set(r.day_of_week, list);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.start < sorted[i - 1]!.end) {
        return `Franjas solapadas el ${DAY_LABEL[day]}.`;
      }
    }
  }
  return null;
}

export const exceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    is_closed: z.boolean(),
    start: z.string().regex(TIME_RE).optional().or(z.literal("")),
    end: z.string().regex(TIME_RE).optional().or(z.literal("")),
  })
  .refine(
    (e) => e.is_closed || (!!e.start && !!e.end && e.start < e.end),
    { message: "Indica un horario válido o marca 'cerrado'", path: ["start"] },
  );

export type ExceptionInput = z.infer<typeof exceptionSchema>;
