import type { Metadata } from "next";
import Link from "next/link";

import { getAppointmentByToken } from "@/lib/booking/manage";
import { todayInTz, addDays } from "@/lib/availability/tz";

import { ManageView } from "./manage-view";

export const metadata: Metadata = { title: "Tu reserva · ReservaPrimero" };

export default async function ManageReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const appt = await getAppointmentByToken(token);

  if (!appt) {
    return (
      <div className="bg-aurora flex min-h-svh flex-col items-center justify-center px-4 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold">No encontramos esta reserva</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            El enlace puede ser incorrecto o la reserva ya no existe.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const today = todayInTz(appt.timeZone);
  return (
    <ManageView
      appt={appt}
      minDate={today}
      maxDate={addDays(today, appt.maxBookingDays)}
    />
  );
}
