import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";

export type AgendaAppointment = {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  serviceName: string;
  serviceColor: string | null;
  staffName: string;
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
      `id, status, start_at, end_at, notes,
       services ( name, color ),
       staff_members ( display_name ),
       customers ( name, phone )`,
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
      serviceName: service?.name ?? "—",
      serviceColor: service?.color ?? null,
      staffName: staff?.display_name ?? "—",
      customerName: customer?.name ?? "—",
      customerPhone: customer?.phone ?? null,
    };
  });
}
