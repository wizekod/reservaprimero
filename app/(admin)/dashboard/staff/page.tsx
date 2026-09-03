import type { Metadata } from "next";
import Link from "next/link";

import { listStaff, type StaffStatus } from "@/lib/staff/queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { StaffRowActions } from "@/components/staff/staff-row-actions";

export const metadata: Metadata = { title: "Staff · ReservaPrimero" };

const STATUS_PILL: Record<StaffStatus, string> = {
  active: "Con acceso",
  invited: "Invitación enviada",
  no_login: "Sin acceso",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const [{ aviso }, staff] = await Promise.all([searchParams, listStaff()]);
  const inviteWarning = aviso?.startsWith("invitacion:")
    ? aviso.slice("invitacion:".length)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Profesionales del negocio. Con correo pueden acceder a su propio
            panel de citas.
          </p>
        </div>
        <Link
          href="/dashboard/staff/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Añadir staff
        </Link>
      </div>

      {inviteWarning ? (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          El miembro se creó, pero la invitación no se envió: {inviteWarning}
        </p>
      ) : null}

      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no tienes staff.{" "}
            <Link
              href="/dashboard/staff/nuevo"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Añade el primero
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {staff.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.display_name}</span>
                  {!m.active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactivo
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {STATUS_PILL[m.status]}
                  {m.invited_email ? ` · ${m.invited_email}` : ""}
                  {` · ${m.service_ids.length} servicio${m.service_ids.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/dashboard/staff/${m.id}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Editar
                </Link>
                <StaffRowActions id={m.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
