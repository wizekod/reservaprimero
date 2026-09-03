import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ServiceRow } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";

/** Servicios del negocio actual (activos e inactivos), para el panel admin. */
export async function listServices(): Promise<ServiceRow[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  return data ?? [];
}

export async function getService(id: string): Promise<ServiceRow | null> {
  const business = await getMyBusiness();
  if (!business) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  return data;
}
