"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { getMyBusiness } from "@/lib/businesses/queries";
import { emptyToUndefined, type FormState } from "@/lib/forms";

const nameField = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(60, "Máximo 60 caracteres");

const emailOpt = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Correo inválido").optional(),
);

const createSchema = z.object({ display_name: nameField, email: emailOpt });
const updateSchema = z.object({
  display_name: nameField,
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

const INVITE_REDIRECT = `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/auth/definir-clave`;

/**
 * Invita (o re-invita si hay un usuario pendiente sin sesión previa).
 * Devuelve el mensaje de error o `null`.
 */
async function inviteStaff(
  email: string,
  staffMemberId: string,
  businessId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const opts = {
    redirectTo: INVITE_REDIRECT,
    data: { staff_member_id: staffMemberId, business_id: businessId },
  };

  let { error } = await admin.auth.admin.inviteUserByEmail(email, opts);

  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (existing && !existing.last_sign_in_at) {
      await admin.auth.admin.deleteUser(existing.id);
      ({ error } = await admin.auth.admin.inviteUserByEmail(email, opts));
    } else if (existing) {
      return "Ese correo ya tiene una cuenta con sesión iniciada.";
    }
  }
  return error ? "No se pudo enviar la invitación." : null;
}

export async function createStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusiness();
  if (!business) return { error: "No autorizado." };

  const parsed = createSchema.safeParse({
    display_name: formData.get("display_name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { display_name, email } = parsed.data;

  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("staff_members")
    .insert({
      business_id: business.id,
      display_name,
      invited_email: email ?? null,
    })
    .select("id")
    .single();
  if (error || !member) {
    return { error: "No se pudo crear el miembro del staff." };
  }

  if (email) {
    const inviteError = await inviteStaff(email, member.id, business.id);
    revalidatePath("/dashboard/staff");
    if (inviteError) {
      redirect(
        `/dashboard/staff?aviso=${encodeURIComponent("invitacion:" + inviteError)}`,
      );
    }
  }

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff");
}

export async function updateStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await getMyBusiness();
  if (!business) return { error: "No autorizado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "No encontrado." };

  const parsed = updateSchema.safeParse({
    display_name: formData.get("display_name"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update({
      display_name: parsed.data.display_name,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { error: "No se pudieron guardar los cambios." };

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff");
}

export async function deleteStaff(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "Tiene citas asociadas. Desactívalo." };
    }
    return { ok: false, error: "No se pudo eliminar." };
  }
  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function resendInvite(
  staffId: string,
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { data: sm } = await supabase
    .from("staff_members")
    .select("id, invited_email, profile_id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!sm?.invited_email) return { ok: false, error: "Sin correo de invitación." };
  if (sm.profile_id) return { ok: false, error: "La invitación ya fue aceptada." };

  const err = await inviteStaff(sm.invited_email, sm.id, business.id);
  return err ? { ok: false, error: err } : { ok: true };
}

export async function setStaffServices(
  staffId: string,
  serviceIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();

  const { data: sm } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!sm) return { ok: false, error: "No encontrado." };

  const { data: svcs } = await supabase
    .from("services")
    .select("id")
    .eq("business_id", business.id);
  const valid = new Set((svcs ?? []).map((s) => s.id));
  const toInsert = [...new Set(serviceIds)].filter((id) => valid.has(id));

  const { error: delError } = await supabase
    .from("staff_services")
    .delete()
    .eq("staff_member_id", staffId);
  if (delError) return { ok: false, error: "No se pudieron actualizar." };

  if (toInsert.length) {
    const { error } = await supabase
      .from("staff_services")
      .insert(toInsert.map((service_id) => ({ staff_member_id: staffId, service_id })));
    if (error) return { ok: false, error: "No se pudieron guardar los servicios." };
  }

  revalidatePath(`/dashboard/staff/${staffId}`);
  revalidatePath("/dashboard/staff");
  return { ok: true };
}
