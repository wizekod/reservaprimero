"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(1, "Repite la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

/**
 * Define la contraseña de una cuenta recién verificada (invitación de staff o
 * confirmación de correo) y, si es un staff invitado, hace la vinculación
 * validada contra `staff_members.invited_email`.
 */
export async function setInitialPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: "No se pudo guardar la contraseña." };

  const staffMemberId = user.user_metadata?.staff_member_id;
  let dest = "/dashboard";

  if (typeof staffMemberId === "string") {
    const admin = createAdminClient();
    const { data: sm } = await admin
      .from("staff_members")
      .select("id, business_id, invited_email, profile_id")
      .eq("id", staffMemberId)
      .maybeSingle();

    const emailMatches =
      sm?.invited_email &&
      user.email &&
      sm.invited_email.toLowerCase() === user.email.toLowerCase();

    if (sm && !sm.profile_id && emailMatches) {
      await admin
        .from("staff_members")
        .update({ profile_id: user.id })
        .eq("id", sm.id);
      await admin
        .from("profiles")
        .update({ role: "staff", business_id: sm.business_id })
        .eq("id", user.id);
      dest = "/staff";
    }
  }

  redirect(dest);
}
