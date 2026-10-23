"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyBusiness, getMyBusinessAsAdmin } from "@/lib/businesses/queries";
import { getMyAccess, type PanelAccess } from "@/lib/staff/access";
import type { BusinessRow } from "@/lib/supabase/database.types";
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

/**
 * El admin, o un profesional con permiso para editar clientes. Quien llama
 * escribe con su propia sesión, así que la RLS de `customers` (y el trigger
 * que protege teléfono y correo) vuelve a decidir; esto sólo da un mensaje
 * claro antes.
 */
async function editor(
  needs: "create" | "update",
): Promise<{ access: PanelAccess; business: BusinessRow } | null> {
  const [access, business] = await Promise.all([getMyAccess(), getMyBusiness()]);
  if (!access || !business || business.id !== access.businessId) return null;
  const p = access.permissions;
  if (!p.editCustomers) return null;
  // Una ficha suelta, sin citas, sólo la puede abrir quien ve a todos.
  if (needs === "create" && p.customersScope !== "all") return null;
  return { access, business };
}

function revalidateCustomers(id?: string) {
  for (const base of ["/dashboard/clientes", "/staff/clientes"]) {
    revalidatePath(base);
    if (id) revalidatePath(`${base}/${id}`);
  }
}

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await editor("create");
  if (!auth) return { error: "No autorizado." };
  const { business, access } = auth;

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

  revalidateCustomers();
  redirect(`${access.paths.customers}/${data.id}`);
}

export async function updateCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await editor("update");
  if (!auth) return { error: "No autorizado." };
  const { business, access } = auth;
  // Sin permiso de contacto el formulario no lleva teléfono ni correo: se
  // cambia sólo el nombre, sin borrar lo que no ve.
  const withContact = access.permissions.seeCustomerContact;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Cliente no encontrado." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  if (withContact) {
    const malTelefono = validarTelefono(d.phone, business.phone_country_code);
    if (malTelefono) return malTelefono;
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("customers")
    .update(
      withContact
        ? { name: d.name, phone: d.phone ?? null, email: d.email ?? null }
        : { name: d.name },
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id");

  if (error) {
    if (error.code === "23505") return { fieldErrors: { phone: [DUPLICADO] } };
    return { error: "No se pudieron guardar los cambios." };
  }
  // La RLS no da error al no dejar editar: simplemente no actualiza nada.
  if ((updated ?? []).length === 0) {
    return { error: "No tienes permiso para editar este cliente." };
  }

  revalidateCustomers(id);
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

  revalidateCustomers();
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
  // Quien puede crear citas desde el panel: el admin o un profesional con ese
  // permiso. Se lee con service_role porque un profesional que sólo ve sus
  // clientes también tiene que reconocer a uno que vuelve con otro compañero.
  // Ya conoce el teléfono (lo acaba de escribir); el correo sólo se devuelve
  // si tiene permiso de contacto.
  const [access, business] = await Promise.all([getMyAccess(), getMyBusiness()]);
  if (!access || !business || business.id !== access.businessId) return { found: false };
  if (access.permissions.bookingScope === "none") return { found: false };

  const key = phoneKey(phone, business.phone_country_code);
  if (!key) return { found: false };

  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, name, email")
    .eq("business_id", business.id)
    .eq("phone_key", key)
    .maybeSingle();

  if (!data) return { found: false };
  return {
    found: true,
    id: data.id,
    name: data.name,
    email: access.permissions.seeCustomerContact ? data.email : null,
  };
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
