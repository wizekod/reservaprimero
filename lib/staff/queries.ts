import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffMemberRow } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";

export type StaffStatus = "active" | "invited" | "no_login";

export type StaffMemberWithMeta = StaffMemberRow & {
  status: StaffStatus;
  service_ids: string[];
};

function statusOf(row: Pick<StaffMemberRow, "profile_id" | "invited_email">): StaffStatus {
  if (row.profile_id) return "active";
  if (row.invited_email) return "invited";
  return "no_login";
}

export async function listStaff(): Promise<StaffMemberWithMeta[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("*, staff_services(service_id)")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  return (data ?? []).map((row) => {
    const { staff_services, ...member } = row;
    return {
      ...member,
      status: statusOf(member),
      service_ids: (staff_services ?? []).map((s) => s.service_id),
    };
  });
}

export async function getStaffMember(
  id: string,
): Promise<StaffMemberWithMeta | null> {
  const business = await getMyBusiness();
  if (!business) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("*, staff_services(service_id)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) return null;
  const { staff_services, ...member } = data;
  return {
    ...member,
    status: statusOf(member),
    service_ids: (staff_services ?? []).map((s) => s.service_id),
  };
}
