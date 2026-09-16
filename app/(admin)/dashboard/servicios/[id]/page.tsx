import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateService } from "@/lib/services/actions";
import { getService } from "@/lib/services/queries";
import { getMyBusiness } from "@/lib/businesses/queries";
import { ServiceForm } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Editar servicio · ReservaPrimero" };

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [business, service] = await Promise.all([getMyBusiness(), getService(id)]);
  if (!business || !service) notFound();

  return (
    <ServiceForm
      action={updateService}
      businessId={business.id}
      service={service}
      title="Editar servicio"
      submitLabel="Guardar cambios"
    />
  );
}
