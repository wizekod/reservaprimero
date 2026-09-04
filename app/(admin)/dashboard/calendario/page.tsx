import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { Calendar } from "@/components/appointments/calendar/calendar";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Calendario · ReservaPrimero" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        <Link
          href="/dashboard/nueva-reserva"
          className={buttonVariants({ size: "sm" })}
        >
          <PlusCircle className="size-4" />
          Nueva reserva
        </Link>
      </div>
      <Calendar basePath="/dashboard/calendario" d={sp.d} v={sp.v} />
    </div>
  );
}
