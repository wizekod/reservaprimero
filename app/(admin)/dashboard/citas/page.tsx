import type { Metadata } from "next";

import { Agenda } from "@/components/appointments/agenda";

export const metadata: Metadata = { title: "Citas · ReservaPrimero" };

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
      <Agenda basePath="/dashboard/citas" d={sp.d} v={sp.v} />
    </div>
  );
}
