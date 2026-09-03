import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicBusiness, getPublicServices } from "@/lib/booking/queries";
import { addDays, todayInTz } from "@/lib/availability/tz";

import { BookingFlow } from "./booking-flow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  return {
    title: business ? `Reservar en ${business.name}` : "Reservar",
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();

  const services = await getPublicServices(business.id);
  const today = todayInTz(business.timezone);

  return (
    <BookingFlow
      slug={slug}
      business={{
        name: business.name,
        logo_url: business.logo_url,
        brand_color: business.brand_color,
        phone: business.phone,
        address: business.address,
      }}
      services={services}
      minDate={today}
      maxDate={addDays(today, business.max_booking_days)}
    />
  );
}
