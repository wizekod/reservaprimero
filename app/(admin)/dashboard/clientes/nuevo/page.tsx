import type { Metadata } from "next";

import { createCustomer } from "@/lib/customers/actions";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Nuevo cliente · ReservaPrimero" };

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-xl">
      <CustomerForm
        action={createCustomer}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
      />
    </div>
  );
}
