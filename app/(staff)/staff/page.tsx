import type { Metadata } from "next";

import { Agenda } from "@/components/appointments/agenda";

export const metadata: Metadata = { title: "Mis citas · ReservaPrimero" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mis citas</h1>
      <p className="text-sm text-muted-foreground">
        Solo las citas asignadas a ti.
      </p>
      <Agenda basePath="/staff" d={sp.d} v={sp.v} />
    </div>
  );
}
