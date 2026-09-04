import type { Metadata } from "next";

import { getMyBusiness } from "@/lib/businesses/queries";
import { getPublicServices } from "@/lib/booking/queries";
import { addDays, todayInTz } from "@/lib/availability/tz";
import { NewBookingForm } from "@/components/appointments/new-booking-form";

export const metadata: Metadata = { title: "Nueva reserva · ReservaPrimero" };

export default async function NuevaReservaPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const services = await getPublicServices(business.id);
  const today = todayInTz(business.timezone);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva reserva</h1>
        <p className="text-sm text-muted-foreground">
          Crea una cita a mano. Se guarda como confirmada.
        </p>
      </div>
      <NewBookingForm
        slug={business.slug}
        services={services}
        minDate={today}
        maxDate={addDays(today, business.max_booking_days)}
      />
    </div>
  );
}
