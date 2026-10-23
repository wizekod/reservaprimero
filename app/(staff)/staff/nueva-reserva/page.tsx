import type { Metadata } from "next";

import { requireStaffPermission } from "@/lib/staff/access";
import { NewBookingPage } from "@/components/appointments/new-booking-page";

export const metadata: Metadata = { title: "Nueva reserva · ReservaPrimero" };

export default async function StaffNuevaReservaPage() {
  const access = await requireStaffPermission((p) => p.bookingScope !== "none");
  return <NewBookingPage access={access} />;
}
