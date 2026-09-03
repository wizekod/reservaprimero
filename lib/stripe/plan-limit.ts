import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTz, wallTimeToInstant } from "@/lib/availability/tz";

/**
 * ¿El negocio puede crear otra reserva este mes? Aplica el
 * `monthly_booking_limit` del plan (null = ilimitado). Cuenta las citas del mes
 * en curso (zona horaria del negocio) que no estén canceladas.
 */
export async function isWithinMonthlyBookingLimit(
  businessId: string,
  timeZone: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("plan_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business?.plan_id) return true;

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("monthly_booking_limit")
    .eq("id", business.plan_id)
    .maybeSingle();
  const limit = plan?.monthly_booking_limit;
  if (limit == null) return true;

  const monthStr = todayInTz(timeZone).slice(0, 7); // YYYY-MM
  const monthStart = wallTimeToInstant(`${monthStr}-01`, "00:00", timeZone).toISOString();

  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("created_at", monthStart);

  return (count ?? 0) < limit;
}
