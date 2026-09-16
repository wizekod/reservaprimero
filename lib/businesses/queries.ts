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
 * Negocio del usuario actual **sólo si es su administrador**.
 *
 * `getMyBusiness()` también devuelve negocio para un perfil `staff`, que
 * legítimamente lo necesita (zona horaria, nombre, ajustes de reserva). Por eso
 * no vale como autorización: cualquier acción de servidor que escriba con el
 * cliente `service_role` — que salta la RLS — tiene que usar ésta, o un staff
 * podría, por ejemplo, crear citas en la agenda de un compañero invocando la
 * acción directamente.
 */
export async function getMyBusinessAsAdmin(): Promise<BusinessRow | null> {
  const profile = await getProfile();
  if (profile?.role !== "business_admin") return null;
  return getMyBusiness();
}

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
