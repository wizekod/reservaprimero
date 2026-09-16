import type { Metadata } from "next";
import Link from "next/link";

import { listCustomers } from "@/lib/customers/queries";
import { CustomerSearch } from "@/components/customers/customer-search";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Clientes · ReservaPrimero" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const customers = await listCustomers(term);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Se crean solos al reservar. Un mismo teléfono es siempre la misma
            ficha, lo escriba como lo escriba.
          </p>
        </div>
        <Link
          href="/dashboard/clientes/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Nuevo cliente
        </Link>
      </div>

      <CustomerSearch initial={term} />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {term ? (
              <>No hay clientes que coincidan con «{term}».</>
            ) : (
              <>
                Aún no tienes clientes.{" "}
                <Link
                  href="/dashboard/clientes/nuevo"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Crea el primero
                </Link>
                .
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/clientes/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
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
