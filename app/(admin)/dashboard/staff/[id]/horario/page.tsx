import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getStaffMember } from "@/lib/staff/queries";
import {
  getWeeklyRules,
  listExceptions,
} from "@/lib/staff/schedule-queries";
import { WeeklyScheduleEditor } from "@/components/staff/weekly-schedule-editor";
import { ExceptionsEditor } from "@/components/staff/exceptions-editor";

export const metadata: Metadata = { title: "Horario · ReservaPrimero" };

export default async function HorarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await getStaffMember(id);
  if (!staff) notFound();

  const [rules, exceptions] = await Promise.all([
    getWeeklyRules(id),
    listExceptions(id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/dashboard/staff/${id}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← {staff.display_name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Horario de {staff.display_name}
      </h1>

      <WeeklyScheduleEditor staffId={id} rules={rules} />
      <ExceptionsEditor staffId={id} exceptions={exceptions} />
    </div>
  );
}
