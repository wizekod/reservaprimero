import type { Metadata } from "next";

import { getMyBusiness } from "@/lib/businesses/queries";
import { listStaffOptions } from "@/lib/appointments/queries";
import { listBusinessExceptions } from "@/lib/staff/schedule-queries";
import { todayInTz } from "@/lib/availability/tz";
import { BlockTimeManager } from "@/components/staff/block-time-manager";

export const metadata: Metadata = { title: "Bloquear horario · ReservaPrimero" };

export default async function BloquearHorarioPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const today = todayInTz(business.timezone);
  const [staff, exceptions] = await Promise.all([
    listStaffOptions(),
    listBusinessExceptions(today),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bloquear horario
        </h1>
        <p className="text-sm text-muted-foreground">
          Feriados, vacaciones o jornadas especiales. Anulan el horario semanal
          en la fecha indicada.
        </p>
      </div>
      <BlockTimeManager staff={staff} exceptions={exceptions} today={today} />
    </div>
  );
}
