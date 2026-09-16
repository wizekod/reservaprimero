import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { createService } from "@/lib/services/actions";
import { getMyBusiness } from "@/lib/businesses/queries";
import { ServiceForm } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Nuevo servicio · ReservaPrimero" };

export default async function NuevoServicioPage() {
  const business = await getMyBusiness();
  if (!business) notFound();

  return (
    <ServiceForm
      action={createService}
      businessId={business.id}
      title="Nuevo servicio"
      submitLabel="Crear servicio"
    />
  );
}
