import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";

export type AvailabilityRuleRow = Tables<"availability_rules">;
export type AvailabilityExceptionRow = Tables<"availability_exceptions">;

/** Comprueba (vía RLS) que el staff pertenece al negocio del usuario. */
async function ownsStaff(staffId: string): Promise<boolean> {
  const business = await getMyBusiness();
  if (!business) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  return Boolean(data);
}

export async function getWeeklyRules(
  staffId: string,
): Promise<AvailabilityRuleRow[]> {
  if (!(await ownsStaff(staffId))) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("staff_member_id", staffId)
    .order("day_of_week")
    .order("start_time");
  return data ?? [];
}

export async function listExceptions(
  staffId: string,
): Promise<AvailabilityExceptionRow[]> {
  if (!(await ownsStaff(staffId))) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability_exceptions")
    .select("*")
    .eq("staff_member_id", staffId)
    .order("date", { ascending: false });
  return data ?? [];
}
