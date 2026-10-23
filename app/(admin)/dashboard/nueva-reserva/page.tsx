import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMyAccess } from "@/lib/staff/access";
import { NewBookingPage } from "@/components/appointments/new-booking-page";

export const metadata: Metadata = { title: "Nueva reserva · ReservaPrimero" };

export default async function NuevaReservaPage() {
  const access = await getMyAccess();
  if (!access) notFound();
  return <NewBookingPage access={access} />;
}
