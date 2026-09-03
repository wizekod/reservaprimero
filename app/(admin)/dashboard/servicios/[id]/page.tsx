import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateService } from "@/lib/services/actions";
import { getService } from "@/lib/services/queries";
import { ServiceForm } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Editar servicio · ReservaPrimero" };

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  return (
    <ServiceForm
      action={updateService}
      service={service}
      title="Editar servicio"
      submitLabel="Guardar cambios"
    />
  );
}
