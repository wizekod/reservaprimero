import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { getMyAccess } from "@/lib/staff/access";
import { Calendar } from "@/components/appointments/calendar/calendar";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mis citas · ReservaPrimero" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const [sp, access] = await Promise.all([searchParams, getMyAccess()]);
  const p = access?.permissions;
  const all = p?.viewAllAppointments ?? false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {all ? "Agenda del equipo" : "Mis citas"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {all
              ? p?.manageAllAppointments
                ? "Las citas de todo el equipo."
                : "Las citas de todo el equipo. Solo puedes cambiar las tuyas."
              : "Solo las citas asignadas a ti."}
          </p>
        </div>
        {p && p.bookingScope !== "none" ? (
          <Link href="/staff/nueva-reserva" className={buttonVariants({ size: "sm" })}>
            <PlusCircle className="size-4" />
            Nueva reserva
          </Link>
        ) : null}
      </div>
      <Calendar basePath="/staff" d={sp.d} v={sp.v} />
    </div>
  );
}
