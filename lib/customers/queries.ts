import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/businesses/queries";
import type { AppointmentStatus, CustomerNoteRow, CustomerRow } from "@/lib/supabase/database.types";

export type CustomerListRow = Pick<
  CustomerRow,
  "id" | "name" | "phone" | "phone_key" | "email" | "created_at"
>;

/**
 * PostgREST interpreta `,` `.` `(` `)` `"` y `\` dentro de los filtros, y
 * `%`/`_` son comodines de LIKE. Se eliminan en vez de escaparlos: un buscador
 * no los necesita y así no queda gramática que inyectar.
 */
function safeTerm(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .slice(0, 40);
}

export async function listCustomers(q?: string): Promise<CustomerListRow[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, name, phone, phone_key, email, created_at")
    .eq("business_id", business.id);

  const raw = (q ?? "").trim();
  if (raw.length >= 2) {
    if (/^[\d\s+()\-.]+$/.test(raw)) {
      // Parece un teléfono: se busca por sufijo sobre la clave E.164, así da
      // igual cómo lo escriba quien busca y cómo se guardó en su día.
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 3) query = query.like("phone_key", `%${digits}`);
    } else {
      query = query.ilike("name", `%${safeTerm(raw)}%`);
    }
  }

  const { data } = await query.order("name").limit(100);
  return data ?? [];
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const business = await getMyBusiness();
  if (!business) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  return data;
}

export type CustomerNote = CustomerNoteRow & { authorName: string | null };

/**
 * Historia clínica. La RLS sólo se la sirve al admin del negocio; para el
 * staff devuelve una lista vacía, no un error.
 */
export async function listCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_notes")
    .select("*, profiles ( full_name )")
    .eq("customer_id", customerId)
    .eq("business_id", business.id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const { profiles, ...note } = row as typeof row & {
      profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    const author = Array.isArray(profiles) ? profiles[0] : profiles;
    return { ...note, authorName: author?.full_name ?? null } as CustomerNote;
  });
}

export type CustomerAppointment = {
  id: string;
  startAt: string;
  status: AppointmentStatus;
  serviceName: string;
  staffName: string;
};

export async function listCustomerAppointments(
  customerId: string,
): Promise<CustomerAppointment[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      `id, start_at, status,
       services ( name ),
       staff_members ( display_name )`,
    )
    .eq("customer_id", customerId)
    .eq("business_id", business.id)
    .order("start_at", { ascending: false })
    .limit(50);

  const pick = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  return (data ?? []).map((a) => ({
    id: a.id,
    startAt: a.start_at,
    status: a.status,
    serviceName: pick(a.services)?.name ?? "—",
    staffName: pick(a.staff_members)?.display_name ?? "—",
  }));
}
