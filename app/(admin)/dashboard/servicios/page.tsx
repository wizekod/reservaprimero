import type { Metadata } from "next";
import Link from "next/link";

import { listServices } from "@/lib/services/queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ServiceRowActions } from "./service-row-actions";

export const metadata: Metadata = { title: "Servicios · ReservaPrimero" };

function fmtPrice(n: number) {
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function ServiciosPage() {
  const services = await listServices();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Lo que tus clientes pueden reservar. Los inactivos no aparecen en la
            página pública.
          </p>
        </div>
        <Link
          href="/dashboard/servicios/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Nuevo servicio
        </Link>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no tienes servicios.{" "}
            <Link
              href="/dashboard/servicios/nuevo"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Crea el primero
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {s.color ? (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                  ) : null}
                  <span className="font-medium">{s.name}</span>
                  {!s.active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactivo
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.duration_minutes} min · {fmtPrice(s.price)}
                  {s.buffer_minutes > 0
                    ? ` · +${s.buffer_minutes} min de margen`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/dashboard/servicios/${s.id}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Editar
                </Link>
                <ServiceRowActions id={s.id} active={s.active} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
