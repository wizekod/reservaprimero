import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCustomer } from "@/lib/customers/actions";
import {
  getCustomer,
  listCustomerAppointments,
  listCustomerNotes,
} from "@/lib/customers/queries";
import { getMyBusiness } from "@/lib/businesses/queries";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/appointments/status";
import { todayInTz } from "@/lib/availability/tz";
import { CustomerForm } from "@/components/customers/customer-form";
import { ClinicalHistory } from "@/components/customers/clinical-history";
import { CustomerRowActions } from "../customer-row-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { capitalizeFirst, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cliente · ReservaPrimero" };

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getMyBusiness();
  if (!business) notFound();

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [notes, appointments] = await Promise.all([
    listCustomerNotes(id),
    listCustomerAppointments(id),
  ]);

  const tz = business.timezone;
  const fmt = (iso: string) =>
    capitalizeFirst(
      new Date(iso).toLocaleDateString("es", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      }),
    );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/clientes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Clientes
        </Link>
        <CustomerRowActions id={customer.id} />
      </div>

      <CustomerForm
        action={updateCustomer}
        customer={customer}
        dialCode={business.phone_country_code}
        title={customer.name}
        submitLabel="Guardar cambios"
      />

      <ClinicalHistory customerId={customer.id} notes={notes} timeZone={tz} />

      <Card>
        <CardHeader>
          <CardTitle>Historial de citas</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no ha reservado.
            </p>
          ) : (
            <ul className="divide-y">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/dashboard/calendario?d=${todayInTz(tz, new Date(a.startAt))}&v=dia`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate text-sm font-medium">
                      {a.serviceName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {fmt(a.startAt)} · {a.staffName}
                    </span>
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_BADGE[a.status],
                    )}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
