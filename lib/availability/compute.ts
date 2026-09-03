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
};

export type Slot = {
  staffMemberId: string;
  start: string; // ISO instant
  end: string;
};

const MIN = 60_000;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
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
          if (conflict) continue;

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
