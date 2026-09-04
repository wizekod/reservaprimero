import type { Metadata } from "next";

import { Calendar } from "@/components/appointments/calendar/calendar";

export const metadata: Metadata = { title: "Mis citas · ReservaPrimero" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis citas</h1>
        <p className="text-sm text-muted-foreground">
          Solo las citas asignadas a ti.
        </p>
      </div>
      <Calendar basePath="/staff" d={sp.d} v={sp.v} />
    </div>
  );
}
