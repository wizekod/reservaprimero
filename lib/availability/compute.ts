import { dayOfWeek, eachDate, wallTimeToInstant } from "@/lib/availability/tz";

export type WeeklyRule = {
  staffMemberId: string;
  dayOfWeek: number; // 0-6
  start: string; // "HH:MM"
  end: string;
};

export type ScheduleException = {
  staffMemberId: string;
  date: string; // "YYYY-MM-DD"
  isClosed: boolean;
  start: string | null; // "HH:MM"
  end: string | null;
};

export type BusyInterval = {
  staffMemberId: string;
  startAt: string; // ISO instant
  endAt: string;
};

export type ComputeInput = {
  now: Date;
  timeZone: string;
  service: { durationMinutes: number; bufferMinutes: number };
  minBookingNoticeHours: number;
  maxBookingDays: number;
  slotIntervalMinutes: number;
  dateFrom: string; // "YYYY-MM-DD" (hora local del negocio)
  dateTo: string; // inclusive
  staffIds: string[]; // candidatos (ya filtrados: activos + realizan el servicio)
  rules: WeeklyRule[];
  exceptions: ScheduleException[];
  busy: BusyInterval[]; // citas pending/confirmed
  /**
   * Incluir también, marcados `taken`, los horarios que sólo se pierden por
   * una cita ya agendada. La página pública los enseña tachados: el cliente
   * ve que el negocio tiene movimiento. Nunca para validar una reserva.
   */
  includeTaken?: boolean;
  /**
   * Estaciones de trabajo del negocio. Sólo cuando el negocio tiene límite y
   * el servicio ocupa estación; si no, null. `busy` son las citas de TODO el
   * negocio que ocupan estación, con su limpieza ya sumada al final.
   */
  stations?: { capacity: number; busy: { startAt: string; endAt: string }[] } | null;
  /**
   * Devolver, marcados `stationsFull`, los horarios con profesional libre
   * pero sin estación. Sólo para el admin, que puede agendar igualmente.
   */
  markStationsFull?: boolean;
};

export type Slot = {
  staffMemberId: string;
  start: string; // ISO instant
  end: string;
  /** Ocupado por otra cita: se muestra, pero no se puede reservar. */
  taken?: boolean;
  /** Profesional libre, pero todas las estaciones ocupadas. */
  stationsFull?: boolean;
};

const MIN = 60_000;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Máximo de intervalos simultáneos dentro de [start, end). El pico siempre
 * cae en el inicio de alguno de ellos (o en `start`).
 */
export function maxConcurrent(
  busy: { start: number; end: number }[],
  start: number,
  end: number,
): number {
  const hits = busy.filter((b) => b.start < end && b.end > start);
  if (hits.length === 0) return 0;
  const points = [start, ...hits.map((b) => Math.max(b.start, start))];
  let max = 0;
  for (const t of points) {
    let n = 0;
    for (const b of hits) if (b.start <= t && b.end > t) n += 1;
    if (n > max) max = n;
  }
  return max;
}

/**
 * Slots reservables. Considera horario semanal, excepciones, citas existentes
 * (con buffer del servicio a ambos lados), antelación mínima, horizonte máximo
 * y zona horaria del negocio. Función pura y determinista.
 */
export function computeAvailability(input: ComputeInput): Slot[] {
  const {
    now,
    timeZone,
    service,
    minBookingNoticeHours,
    maxBookingDays,
    slotIntervalMinutes,
    dateFrom,
    dateTo,
    staffIds,
    rules,
    exceptions,
    busy,
    includeTaken = false,
    stations = null,
    markStationsFull = false,
  } = input;

  const durationMs = service.durationMinutes * MIN;
  const bufferMs = Math.max(0, service.bufferMinutes) * MIN;
  const stepMs = Math.max(1, slotIntervalMinutes) * MIN;
  const earliest = now.getTime() + minBookingNoticeHours * 60 * MIN;
  const latest = now.getTime() + maxBookingDays * 24 * 60 * MIN;

  // Índices por staff
  const rulesByStaff = new Map<string, WeeklyRule[]>();
  for (const r of rules) {
    if (!rulesByStaff.has(r.staffMemberId)) rulesByStaff.set(r.staffMemberId, []);
    rulesByStaff.get(r.staffMemberId)!.push(r);
  }
  const excByStaffDate = new Map<string, ScheduleException>();
  for (const e of exceptions) {
    excByStaffDate.set(`${e.staffMemberId}|${e.date}`, e);
  }
  const busyByStaff = new Map<string, { start: number; end: number }[]>();
  for (const b of busy) {
    if (!busyByStaff.has(b.staffMemberId)) busyByStaff.set(b.staffMemberId, []);
    busyByStaff.get(b.staffMemberId)!.push({
      start: new Date(b.startAt).getTime(),
      end: new Date(b.endAt).getTime() + bufferMs,
    });
  }

  const stationBusy = (stations?.busy ?? []).map((b) => ({
    start: new Date(b.startAt).getTime(),
    end: new Date(b.endAt).getTime(),
  }));

  const slots: Slot[] = [];

  for (const date of eachDate(dateFrom, dateTo)) {
    const dow = dayOfWeek(date);

    for (const staffId of staffIds) {
      const windows: { start: string; end: string }[] = [];
      const exc = excByStaffDate.get(`${staffId}|${date}`);

      if (exc) {
        if (!exc.isClosed && exc.start && exc.end) {
          windows.push({ start: exc.start, end: exc.end });
        }
      } else {
        for (const r of rulesByStaff.get(staffId) ?? []) {
          if (r.dayOfWeek === dow) windows.push({ start: r.start, end: r.end });
        }
      }

      const staffBusy = busyByStaff.get(staffId) ?? [];

      for (const w of windows) {
        const winStart = wallTimeToInstant(date, w.start, timeZone).getTime();
        const winEnd = wallTimeToInstant(date, w.end, timeZone).getTime();

        for (let t = winStart; t + durationMs <= winEnd; t += stepMs) {
          const slotEnd = t + durationMs;
          if (t < earliest || t > latest) continue;

          const occStart = t;
          const occEnd = slotEnd + bufferMs;
          const conflict = staffBusy.some((b) =>
            overlaps(occStart, occEnd, b.start, b.end),
          );
          if (conflict) {
            if (includeTaken) {
              slots.push({
                staffMemberId: staffId,
                start: new Date(t).toISOString(),
                end: new Date(slotEnd).toISOString(),
                taken: true,
              });
            }
            continue;
          }

          // La estación se ocupa también durante la limpieza.
          if (
            stations &&
            maxConcurrent(stationBusy, occStart, occEnd) >= stations.capacity
          ) {
            if (markStationsFull || includeTaken) {
              slots.push({
                staffMemberId: staffId,
                start: new Date(t).toISOString(),
                end: new Date(slotEnd).toISOString(),
                ...(markStationsFull ? { stationsFull: true } : { taken: true }),
              });
            }
            continue;
          }

          slots.push({
            staffMemberId: staffId,
            start: new Date(t).toISOString(),
            end: new Date(slotEnd).toISOString(),
          });
        }
      }
    }
  }

  slots.sort(
    (a, b) => a.start.localeCompare(b.start) || a.staffMemberId.localeCompare(b.staffMemberId),
  );
  return slots;
}
