"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getMyBusinessAsAdmin } from "@/lib/businesses/queries";
import {
  normalizePermissions,
  permissionsToRow,
  type StaffPermissions,
} from "@/lib/staff/permissions";

const schema = z.object({
  viewAllAppointments: z.boolean(),
  bookingScope: z.enum(["none", "own", "any"]),
  manageAllAppointments: z.boolean(),
  customersScope: z.enum(["none", "own", "all"]),
  editCustomers: z.boolean(),
  seeCustomerContact: z.boolean(),
});

/**
 * El admin cambia los permisos de un profesional. Escribe con su propia
 * sesión: la RLS de `staff_members` sólo deja escribir al admin del negocio,
 * así que un profesional no puede darse permisos a sí mismo.
 *
 * Se aplican en la siguiente acción de esa persona, sin cerrarle la sesión:
 * la RLS los lee de la tabla en cada consulta.
 */
export async function updateStaffPermissions(
  staffId: string,
  raw: StaffPermissions,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  if (!z.string().uuid().safeParse(staffId).success) {
    return { ok: false, error: "Profesional no encontrado." };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Permisos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_members")
    .update(permissionsToRow(normalizePermissions(parsed.data)))
    .eq("id", staffId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "No se pudieron guardar los permisos." };
  if (!data) return { ok: false, error: "Profesional no encontrado." };

  revalidatePath(`/dashboard/staff/${staffId}`);
  revalidatePath("/dashboard/staff");
  return { ok: true };
}
