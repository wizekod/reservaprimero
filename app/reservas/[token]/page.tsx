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
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No encontramos esta reserva</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace puede ser incorrecto o la reserva ya no existe.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Ir al inicio
        </Link>
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
