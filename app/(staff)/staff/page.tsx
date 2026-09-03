import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis citas · ReservaPrimero" };

export default function StaffPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Mis citas</h1>
      <p className="text-sm text-muted-foreground">
        Aquí verás únicamente las citas asignadas a ti. El calendario del staff
        llega en el bloque «Dashboard staff» de Fase 1.
      </p>
    </div>
  );
}
