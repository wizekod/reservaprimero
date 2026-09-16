import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";
import { getProfile } from "@/lib/auth/dal";

export type AgendaAppointment = {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  staffMemberId: string;
  serviceName: string;
  servicePrice: number;
  serviceColor: string | null;
  staffName: string;
  staffColor: string | null;
  staffAvatarPath: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
};

type Nested<T> = T | T[] | null;
const pick = <T,>(v: Nested<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Citas del negocio actual entre dos instantes (por `start_at`). */
export async function listAppointments(
  fromISO: string,
  toISO: string,
): Promise<AgendaAppointment[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      `id, status, start_at, end_at, notes, staff_member_id,
       services ( name, color, price ),
       staff_members ( display_name, color, avatar_path ),
       customers ( id, name, phone )`,
    )
    .eq("business_id", business.id)
    .gte("start_at", fromISO)
    .lt("start_at", toISO)
    .order("start_at");

  return (data ?? []).map((row) => {
    const service = pick(row.services);
    const staff = pick(row.staff_members);
    const customer = pick(row.customers);
    return {
      id: row.id,
      status: row.status,
      startAt: row.start_at,
      endAt: row.end_at,
      notes: row.notes,
      staffMemberId: row.staff_member_id,
      serviceName: service?.name ?? "—",
      servicePrice: Number(service?.price ?? 0),
      serviceColor: service?.color ?? null,
      staffName: staff?.display_name ?? "—",
      staffColor: staff?.color ?? null,
      staffAvatarPath: staff?.avatar_path ?? null,
      customerId: customer?.id ?? "",
      customerName: customer?.name ?? "—",
      customerPhone: customer?.phone ?? null,
    };
  });
}

/** Staff activo del negocio actual (para filtros del calendario). */
export type StaffOption = {
  id: string;
  name: string;
  color: string | null;
  avatarPath: string | null;
};

export async function listStaffOptions(): Promise<StaffOption[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  let query = supabase
    .from("staff_members")
    .select("id, display_name, color, avatar_path")
    .eq("business_id", business.id)
    .eq("active", true);

  // Un miembro del staff sólo tiene sus propias citas, así que un filtro por
  // profesional no le sirve de nada y sólo le enseña la plantilla del negocio.
  // La RLS no lo recorta porque `staff_members` es de lectura pública (la
  // página de reservas necesita listar a los profesionales).
  const profile = await getProfile();
  if (profile?.role === "staff") {
    query = query.eq("profile_id", profile.id);
  }

  const { data } = await query.order("display_name");
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.display_name,
    color: s.color,
    avatarPath: s.avatar_path,
  }));
}
