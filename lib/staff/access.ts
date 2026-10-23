import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import {
  FULL_PERMISSIONS,
  permissionsFromRow,
  type StaffPermissions,
} from "@/lib/staff/permissions";

/**
 * Qué puede hacer en el panel quien tiene la sesión: el admin del negocio
 * todo, un profesional lo que su admin le haya dado.
 *
 * Sirve para decidir qué se enseña y para autorizar las acciones de servidor
 * que escriben con service_role. Lo que se lee con la sesión del usuario lo
 * recorta además la RLS, con las mismas columnas.
 */
export type PanelAccess = {
  role: "business_admin" | "staff";
  businessId: string;
  /** Su ficha de profesional (el dueño puede no tenerla). */
  staffMemberId: string | null;
  permissions: StaffPermissions;
  /** Rutas de su panel. */
  paths: { agenda: string; newBooking: string; customers: string };
};

const ADMIN_PATHS = {
  agenda: "/dashboard/calendario",
  newBooking: "/dashboard/nueva-reserva",
  customers: "/dashboard/clientes",
};

const STAFF_PATHS = {
  agenda: "/staff",
  newBooking: "/staff/nueva-reserva",
  customers: "/staff/clientes",
};

export const getMyAccess = cache(async (): Promise<PanelAccess | null> => {
  const profile = await getProfile();
  if (!profile?.business_id) return null;
  if (profile.role !== "business_admin" && profile.role !== "staff") return null;

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff_members")
    .select(
      `id, can_view_all_appointments, booking_scope, can_manage_all_appointments,
       customers_scope, can_edit_customers, can_see_customer_contact`,
    )
    .eq("profile_id", profile.id)
    .eq("business_id", profile.business_id)
    .limit(1)
    .maybeSingle();

  if (profile.role === "business_admin") {
    return {
      role: "business_admin",
      businessId: profile.business_id,
      staffMemberId: staff?.id ?? null,
      permissions: FULL_PERMISSIONS,
      paths: ADMIN_PATHS,
    };
  }

  // Un staff sin ficha (lo borraron) no tiene agenda ni permisos.
  if (!staff) return null;
  return {
    role: "staff",
    businessId: profile.business_id,
    staffMemberId: staff.id,
    permissions: permissionsFromRow(staff),
    paths: STAFF_PATHS,
  };
});

/** Para páginas del panel de staff: sin el permiso, 404. */
export async function requireStaffPermission(
  allowed: (p: StaffPermissions) => boolean,
): Promise<PanelAccess> {
  const access = await getMyAccess();
  if (!access || !allowed(access.permissions)) notFound();
  return access;
}
