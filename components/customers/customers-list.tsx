import Link from "next/link";

import { listCustomers } from "@/lib/customers/queries";
import type { PanelAccess } from "@/lib/staff/access";
import { maskedPhone } from "@/lib/staff/permissions";
import { CustomerSearch } from "@/components/customers/customer-search";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Lista de clientes, compartida por el panel del admin y el del staff. */
export async function CustomersList({
  access,
  q,
}: {
  access: PanelAccess;
  q?: string;
}) {
  const term = (q ?? "").trim();
  const customers = await listCustomers(term);
  const p = access.permissions;
  const base = access.paths.customers;
  const canCreate = p.editCustomers && p.customersScope === "all";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {p.customersScope === "own"
              ? "Los clientes que han tenido cita contigo."
              : "Se crean solos al reservar. Un mismo teléfono es siempre la misma ficha, lo escriba como lo escriba."}
          </p>
        </div>
        {canCreate ? (
          <Link href={`${base}/nuevo`} className={buttonVariants({ size: "sm" })}>
            Nuevo cliente
          </Link>
        ) : null}
      </div>

      <CustomerSearch
        initial={term}
        placeholder={p.seeCustomerContact ? undefined : "Buscar por nombre"}
      />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {term ? (
              <>No hay clientes que coincidan con «{term}».</>
            ) : canCreate ? (
              <>
                Aún no tienes clientes.{" "}
                <Link
                  href={`${base}/nuevo`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Crea el primero
                </Link>
                .
              </>
            ) : (
              <>Aún no hay clientes.</>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`${base}/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[c.phone ?? maskedPhone(c.phone_last4), c.email]
                      .filter(Boolean)
                      .join(" · ") || "Sin contacto"}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
