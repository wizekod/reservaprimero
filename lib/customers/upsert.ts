import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type UpsertCustomerInput = {
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
};

export type UpsertCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string };

/**
 * Find-or-create de cliente por teléfono canónico.
 *
 * Toda la lógica vive en el RPC `upsert_customer`: canoniza el teléfono, busca
 * e inserta en una sola sentencia atómica. Sustituye al bloque "buscar y si no
 * insertar" que estaba duplicado en la reserva pública y en el alta manual,
 * donde dos reservas simultáneas con el mismo número podían crear dos fichas.
 *
 * Necesita el cliente `service_role`: el RPC no está concedido a `anon` ni a
 * `authenticated`.
 */
export async function upsertCustomer(
  admin: SupabaseClient<Database>,
  input: UpsertCustomerInput,
): Promise<UpsertCustomerResult> {
  const { data, error } = await admin.rpc("upsert_customer", {
    p_business_id: input.businessId,
    p_name: input.name.trim(),
    p_phone: input.phone.trim(),
    // Omitido en vez de null: el RPC ya tiene `default null` y el tipo
    // generado declara el argumento como opcional, no como nullable.
    p_email: input.email?.trim().toLowerCase() || undefined,
  });

  if (error || !data) return { ok: false, error: "No se pudo registrar al cliente." };
  return { ok: true, customerId: data };
}
