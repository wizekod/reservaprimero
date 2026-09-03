import type { Metadata } from "next";

import { getProfile } from "@/lib/auth/dal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Panel · ReservaPrimero" };

export default async function DashboardPage() {
  const profile = await getProfile();
  const hasBusiness = Boolean(profile?.business_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Panel de administración de tu negocio.
        </p>
      </div>

      {!hasBusiness ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no configuras tu negocio</CardTitle>
            <CardDescription>
              El siguiente bloque de Fase 1 añade el alta de negocio (nombre,
              slug, zona horaria). Por ahora tu cuenta existe con rol
              «Administrador de negocio».
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Negocio conectado</CardTitle>
            <CardDescription>
              business_id: <code>{profile?.business_id}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Servicios, staff, horarios y citas llegan en los próximos bloques.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
