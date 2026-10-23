import { getMyBusiness } from "@/lib/businesses/queries";
import { getPublicServices } from "@/lib/booking/queries";
import { addDays, todayInTz } from "@/lib/availability/tz";
import type { PanelAccess } from "@/lib/staff/access";
import { NewBookingForm } from "@/components/appointments/new-booking-form";

/** "Nueva reserva", compartida por el panel del admin y el del staff. */
export async function NewBookingPage({ access }: { access: PanelAccess }) {
  const business = await getMyBusiness();
  if (!business) return null;

  const services = await getPublicServices(business.id);
  const today = todayInTz(business.timezone);
  const onlyOwn = access.permissions.bookingScope === "own";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva reserva</h1>
        <p className="text-sm text-muted-foreground">
          {onlyOwn
            ? "Crea una cita en tu agenda. Se guarda como confirmada."
            : "Crea una cita a mano. Se guarda como confirmada."}
        </p>
      </div>
      <NewBookingForm
        slug={business.slug}
        services={services}
        minDate={today}
        maxDate={addDays(today, business.max_booking_days)}
        dialCode={business.phone_country_code}
        agendaPath={access.paths.agenda}
        onlyStaffId={onlyOwn ? access.staffMemberId : null}
      />
    </div>
  );
}
