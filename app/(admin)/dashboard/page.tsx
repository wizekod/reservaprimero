import type { Metadata } from "next";
import Link from "next/link";

import { getProfile } from "@/lib/auth/dal";
import { getMyBusiness } from "@/lib/businesses/queries";
import { clientEnv } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Panel · ReservaPrimero" };

const STATUS_LABEL: Record<string, string> = {
  trial: "Prueba",
  active: "Activo",
  suspended: "Suspendido",
};

export default async function DashboardPage() {
  const [profile, business] = await Promise.all([getProfile(), getMyBusiness()]);
  if (!business) return null; // el layout ya redirige a /onboarding

  const hostBase = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Panel de {business.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>{business.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {STATUS_LABEL[business.status] ?? business.status}
            </span>
          </CardTitle>
          <CardDescription>
            Página pública:{" "}
            <span className="font-medium">
              {hostBase}/{business.slug}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/dashboard/citas"
            className={buttonVariants({ size: "sm" })}
          >
            Citas
          </Link>
          <Link
            href="/dashboard/servicios"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Servicios
          </Link>
          <Link
            href="/dashboard/staff"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Staff
          </Link>
          <Link
            href="/dashboard/configuracion"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Configuración del negocio
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos bloques de Fase 1</CardTitle>
          <CardDescription>
            Horarios del staff, y luego el calendario de citas.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
