import type { Metadata } from "next";

import { createService } from "@/lib/services/actions";
import { ServiceForm } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Nuevo servicio · ReservaPrimero" };

export default function NuevoServicioPage() {
  return (
    <ServiceForm
      action={createService}
      title="Nuevo servicio"
      submitLabel="Crear servicio"
    />
  );
}
