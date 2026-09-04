/**
 * Utilidades de zona horaria sin dependencias.
 * Convierte "hora de pared" (fecha + HH:MM en una IANA tz) a instante UTC,
 * manejando cambios de horario de verano con doble pasada de offset.
 */

function tzParts(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** (hora local − UTC) en ms para `timeZone` en ese instante. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = tzParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

/** `dateStr` = "YYYY-MM-DD", `timeStr` = "HH:MM". Devuelve el instante UTC. */
export function wallTimeToInstant(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guessUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!, 0);
  let ts = guessUtc - offsetMs(new Date(guessUtc), timeZone);
  ts = guessUtc - offsetMs(new Date(ts), timeZone); // 2ª pasada para bordes DST
  return new Date(ts);
}

/** Día de la semana (0=domingo … 6=sábado) de una fecha "YYYY-MM-DD". */
export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Fecha "YYYY-MM-DD" de "ahora" en la zona horaria dada. */
export function todayInTz(timeZone: string, instant: Date = new Date()): string {
  const p = tzParts(instant, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/** Fecha local y minutos desde medianoche de un instante ISO, en la zona dada. */
export function zonedDateAndMinutes(
  iso: string,
  timeZone: string,
): { date: string; minutes: number } {
  const p = tzParts(new Date(iso), timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return { date: `${p.year}-${mm}-${dd}`, minutes: p.hour * 60 + p.minute };
}

/** Primer día del mes de `dateStr` ("YYYY-MM-01"). */
export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Suma `n` meses a "YYYY-MM-DD", devolviendo el día 1 del mes resultante. */
export function addMonths(dateStr: string, n: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Suma `n` días a "YYYY-MM-DD" y devuelve "YYYY-MM-DD". */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Enumera fechas "YYYY-MM-DD" de `from` a `to` inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 366 && cur <= to; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
