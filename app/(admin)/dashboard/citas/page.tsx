import type { Metadata } from "next";

import { getMyBusiness } from "@/lib/businesses/queries";
import { listAppointments } from "@/lib/appointments/queries";
import {
  addDays,
  dayOfWeek,
  todayInTz,
  wallTimeToInstant,
} from "@/lib/availability/tz";
import { AgendaNav } from "@/components/appointments/agenda-nav";
import { AppointmentList } from "@/components/appointments/appointment-list";

export const metadata: Metadata = { title: "Citas · ReservaPrimero" };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const labelDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es", { ...opts, timeZone: "UTC" });

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const business = await getMyBusiness();
  if (!business) return null; // el layout ya redirige a /onboarding

  const tz = business.timezone;
  const today = todayInTz(tz);
  const sp = await searchParams;

  const view = sp.v === "semana" ? "semana" : "dia";
  const date =
    typeof sp.d === "string" && dateRe.test(sp.d) ? sp.d : today;

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
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
      <AgendaNav
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
