import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createCustomer } from "@/lib/customers/actions";
import { getMyBusiness } from "@/lib/businesses/queries";
import { requireStaffPermission } from "@/lib/staff/access";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Nuevo cliente · ReservaPrimero" };

export default async function StaffNuevoClientePage() {
  await requireStaffPermission((p) => p.editCustomers && p.customersScope === "all");
  const business = await getMyBusiness();
  if (!business) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <CustomerForm
        action={createCustomer}
        dialCode={business.phone_country_code}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
        backHref="/staff/clientes"
      />
    </div>
  );
}
