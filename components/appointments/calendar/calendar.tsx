import { getMyBusiness } from "@/lib/businesses/queries";
import {
  listAppointments,
  listStaffOptions,
} from "@/lib/appointments/queries";
import {
  addDays,
  dayOfWeek,
  startOfMonth,
  todayInTz,
  wallTimeToInstant,
} from "@/lib/availability/tz";

import { CalendarView, type CalendarView as View } from "./calendar-view";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const label = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es", {
    ...opts,
    timeZone: "UTC",
  });

function daysInMonth(monthFirst: string): number {
  const [y, m] = monthFirst.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/**
 * Calendario de citas compartido por el panel admin (`/dashboard/calendario`)
 * y el de staff (`/staff`). El alcance de los datos lo decide RLS.
 */
export async function Calendar({
  basePath,
  d,
  v,
}: {
  basePath: string;
  d?: string;
  v?: string;
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const tz = business.timezone;
  const today = todayInTz(tz);
  const view: View =
    v === "semana" ? "semana" : v === "mes" ? "mes" : "dia";
  const date = typeof d === "string" && dateRe.test(d) ? d : today;
  const monthAnchor = startOfMonth(date);

  let days: string[];
  let rangeLabel: string;

  if (view === "dia") {
    days = [date];
    rangeLabel = label(date, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (view === "semana") {
    const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
    days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    rangeLabel = `${label(days[0]!, { day: "numeric", month: "short" })} – ${label(
      days[6]!,
      { day: "numeric", month: "short", year: "numeric" },
    )}`;
  } else {
    const back = (dayOfWeek(monthAnchor) + 6) % 7;
    const gridStart = addDays(monthAnchor, -back);
    const cells = Math.ceil((back + daysInMonth(monthAnchor)) / 7) * 7;
    days = Array.from({ length: cells }, (_, i) => addDays(gridStart, i));
    rangeLabel = label(monthAnchor, { month: "long", year: "numeric" });
  }

  const fromISO = wallTimeToInstant(days[0]!, "00:00", tz).toISOString();
  const toISO = wallTimeToInstant(
    addDays(days[days.length - 1]!, 1),
    "00:00",
    tz,
  ).toISOString();

  const [appointments, staff] = await Promise.all([
    listAppointments(fromISO, toISO),
    listStaffOptions(),
  ]);

  return (
    <CalendarView
      basePath={basePath}
      view={view}
      date={date}
      today={today}
      timeZone={tz}
      days={days}
      appointments={appointments}
      staff={staff}
      rangeLabel={rangeLabel}
      monthAnchor={monthAnchor}
    />
  );
}
