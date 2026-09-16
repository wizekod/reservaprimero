import type { Metadata } from "next";

import { createCustomer } from "@/lib/customers/actions";
import { CustomerForm } from "@/components/customers/customer-form";
import { getMyBusiness } from "@/lib/businesses/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Nuevo cliente · ReservaPrimero" };

export default async function NuevoClientePage() {
  const business = await getMyBusiness();
  if (!business) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <CustomerForm
        action={createCustomer}
        dialCode={business.phone_country_code}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
      />
    </div>
  );
}
