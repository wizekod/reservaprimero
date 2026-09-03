import { getMyBusiness } from "@/lib/businesses/queries";
import { listAppointments } from "@/lib/appointments/queries";
import {
  addDays,
  dayOfWeek,
  todayInTz,
  wallTimeToInstant,
} from "@/lib/availability/tz";

import { AgendaNav } from "./agenda-nav";
import { AppointmentList } from "./appointment-list";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const labelDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es", { ...opts, timeZone: "UTC" });

/** Agenda de citas compartida por el panel admin (`/dashboard/citas`) y el de staff (`/staff`). RLS decide el alcance. */
export async function Agenda({
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
  const view = v === "semana" ? "semana" : "dia";
  const date = typeof d === "string" && dateRe.test(d) ? d : today;

  let startDate = date;
  let endDate = date;
  if (view === "semana") {
    const backToMonday = (dayOfWeek(date) + 6) % 7;
    startDate = addDays(date, -backToMonday);
    endDate = addDays(startDate, 6);
  }

  const fromISO = wallTimeToInstant(startDate, "00:00", tz).toISOString();
  const toISO = wallTimeToInstant(addDays(endDate, 1), "00:00", tz).toISOString();
  const appointments = await listAppointments(fromISO, toISO);

  const rangeLabel =
    view === "semana"
      ? `${labelDate(startDate, { day: "numeric", month: "short" })} – ${labelDate(endDate, { day: "numeric", month: "short" })}`
      : labelDate(date, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <AgendaNav
        basePath={basePath}
        date={view === "semana" ? startDate : date}
        view={view}
        rangeLabel={rangeLabel}
        today={today}
      />
      <AppointmentList
        appointments={appointments}
        timeZone={tz}
        showDayHeaders={view === "semana"}
      />
    </div>
  );
}
