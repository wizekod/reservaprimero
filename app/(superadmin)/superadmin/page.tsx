import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plataforma · ReservaPrimero" };

export default function SuperadminPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
      <p className="text-sm text-muted-foreground">
        Listado de negocios, planes y métricas globales. Llega en el bloque
        «Dashboard superadmin» de Fase 1.
      </p>
    </div>
  );
}
