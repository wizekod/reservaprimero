import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/businesses/queries";
import { getMyAccess } from "@/lib/staff/access";
import type { AppointmentStatus, CustomerNoteRow } from "@/lib/supabase/database.types";

/**
 * Ficha de cliente tal como la puede ver quien consulta. Sale de la vista
 * `customer_contacts`: teléfono y correo llegan en null si es un profesional
 * sin permiso de contacto (con `phone_last4` para reconocerlo igualmente).
 */
export type CustomerContact = {
  id: string;
  name: string;
  phone: string | null;
  phone_key: string | null;
  email: string | null;
  phone_last4: string | null;
  created_at: string;
};

const CONTACT_COLUMNS = "id, name, phone, phone_key, email, phone_last4, created_at";

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

/** "Solo los suyos": los que han tenido cita con este profesional. */
async function onlyMine(): Promise<boolean> {
  const access = await getMyAccess();
  return access?.permissions.customersScope === "own";
}

export async function listCustomers(q?: string): Promise<CustomerContact[]> {
  const business = await getMyBusiness();
  if (!business) return [];

  const supabase = await createClient();
  let query = supabase
    .from("customer_contacts")
    .select(CONTACT_COLUMNS)
    .eq("business_id", business.id);

  // La RLS le deja leer también a los clientes de las citas de sus
  // compañeros (si ve la agenda completa, necesita sus nombres); la sección
  // Clientes con alcance "los suyos" no los lista.
  if (await onlyMine()) query = query.eq("is_mine", true);

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

export async function getCustomer(id: string): Promise<CustomerContact | null> {
  const business = await getMyBusiness();
  if (!business) return null;

  const supabase = await createClient();
  let query = supabase
    .from("customer_contacts")
    .select(CONTACT_COLUMNS)
    .eq("id", id)
    .eq("business_id", business.id);
  if (await onlyMine()) query = query.eq("is_mine", true);

  const { data } = await query.maybeSingle();
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
