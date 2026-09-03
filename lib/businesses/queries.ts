import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessRow } from "@/lib/supabase/database.types";
import { getProfile } from "@/lib/auth/dal";

/** Negocio del usuario actual (vía RLS). `null` si aún no creó ninguno. */
export const getMyBusiness = cache(async (): Promise<BusinessRow | null> => {
  const profile = await getProfile();
  if (!profile?.business_id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", profile.business_id)
    .maybeSingle();

  return data;
});

/**
 * ¿El slug está libre? Usa el cliente admin (lectura) porque RLS impide a un
 * admin ver negocios ajenos. `exceptBusinessId` permite conservar el propio
 * slug al editar.
 */
export async function isSlugAvailable(
  slug: string,
  exceptBusinessId?: string,
): Promise<boolean> {
  const admin = createAdminClient();
  let query = admin.from("businesses").select("id").eq("slug", slug).limit(1);
  if (exceptBusinessId) query = query.neq("id", exceptBusinessId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) === 0;
}
