"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getMyBusinessAsAdmin } from "@/lib/businesses/queries";
import { getProfile } from "@/lib/auth/dal";
import { phoneKey, phoneLengthError } from "@/lib/customers/phone";
import { emptyToUndefined, type FormState } from "@/lib/forms";

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(80, "Máximo 80 caracteres"),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(6, "Teléfono demasiado corto").max(30).optional(),
  ),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().toLowerCase().email("Correo inválido").optional(),
  ),
});

function parse(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });
}

/** Mensaje común: el índice único es por (business_id, phone_key). */
const DUPLICADO =
  "Ya tienes un cliente con ese teléfono. Búscalo en la lista en vez de crear otra ficha.";

/**
 * El largo del teléfono depende del país del negocio, que no se conoce hasta
 * tener el negocio en la mano, así que no cabe en el esquema de zod.
 */
function validarTelefono(
  phone: string | undefined,
  dial: string | null,
): FormState | null {
  if (!phone) return null;
  const error = phoneLengthError(phone, dial);
  return error ? { fieldErrors: { phone: [error] } } : null;
}

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { error: "No autorizado." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  const malTelefono = validarTelefono(d.phone, business.phone_country_code);
  if (malTelefono) return malTelefono;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: d.name,
      phone: d.phone ?? null,
      email: d.email ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { fieldErrors: { phone: [DUPLICADO] } };
    return { error: "No se pudo crear el cliente." };
  }

  revalidatePath("/dashboard/clientes");
  redirect(`/dashboard/clientes/${data.id}`);
}

export async function updateCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { error: "No autorizado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Cliente no encontrado." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  const malTelefono = validarTelefono(d.phone, business.phone_country_code);
  if (malTelefono) return malTelefono;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: d.name,
      phone: d.phone ?? null,
      email: d.email ?? null,
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    if (error.code === "23505") return { fieldErrors: { phone: [DUPLICADO] } };
    return { error: "No se pudieron guardar los cambios." };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${id}`);
  return { message: "Cambios guardados." };
}

export async function deleteCustomer(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    // appointments.customer_id es ON DELETE RESTRICT: un cliente con historial
    // no se borra. No hay "desactivar" en customers, así que se dice tal cual.
    if (error.code === "23503") {
      return { ok: false, error: "Tiene citas registradas; no se puede eliminar." };
    }
    return { ok: false, error: "No se pudo eliminar." };
  }

  revalidatePath("/dashboard/clientes");
  return { ok: true };
}

/**
 * Busca un cliente por teléfono para autorrellenar el alta manual de una cita.
 * Sólo desde el panel: en la página pública dejaría enumerar quién es cliente
 * del negocio escribiendo números, que en una clínica es un problema serio.
 */
export async function lookupCustomerByPhone(phone: string): Promise<
  { found: false } | { found: true; id: string; name: string; email: string | null }
> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { found: false };

  const key = phoneKey(phone, business.phone_country_code);
  if (!key) return { found: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("business_id", business.id)
    .eq("phone_key", key)
    .maybeSingle();

  if (!data) return { found: false };
  return { found: true, id: data.id, name: data.name, email: data.email };
}

// ── Historia clínica ───────────────────────────────────────────────────────
// La RLS de `customer_notes` sólo admite al admin del negocio; estas acciones
// usan el cliente con RLS a propósito, para que sea la base quien decida.

const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escribe algo")
    .max(5000, "Máximo 5000 caracteres"),
});

export async function addCustomerNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusinessAsAdmin();
  const profile = await getProfile();
  if (!business || !profile) return { error: "No autorizado." };

  const customerId = formData.get("customer_id");
  if (typeof customerId !== "string" || !customerId) {
    return { error: "Cliente no encontrado." };
  }

  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").insert({
    business_id: business.id,
    customer_id: customerId,
    body: parsed.data.body,
    author_id: profile.id,
  });

  if (error) return { error: "No se pudo guardar la entrada." };

  revalidatePath(`/dashboard/clientes/${customerId}`);
  return { message: "Entrada añadida." };
}

export async function toggleNotePinned(
  id: string,
  pinned: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_notes")
    .update({ pinned })
    .eq("id", id)
    .eq("business_id", business.id)
    .select("customer_id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath(`/dashboard/clientes/${data.customer_id}`);
  return { ok: true };
}

export async function deleteCustomerNote(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_notes")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id)
    .select("customer_id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath(`/dashboard/clientes/${data.customer_id}`);
  return { ok: true };
}
