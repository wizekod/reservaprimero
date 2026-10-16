"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMyBusinessAsAdmin } from "@/lib/businesses/queries";
import { forgetPendingInvite, inviteStaff } from "@/lib/staff/invite";
import type { FormState } from "@/lib/forms";

/**
 * Acceso al panel de un profesional, gestionado por el admin del negocio:
 * cambiarle el correo con el que entra y ponerle una contraseña nueva (si la
 * olvidó o si ya no debe entrar con la de antes).
 *
 * Se hace con service_role porque toca auth.users de otra persona. Por eso
 * cada acción comprueba antes, en este orden: que quien llama es admin, que
 * el profesional es de su negocio y que la cuenta destino es de staff de ese
 * mismo negocio. Nunca la del dueño: la suya se cambia en Mi cuenta, pidiendo
 * la contraseña actual.
 */

const emailSchema = z.object({
  staffId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
});

const passwordSchema = z
  .object({
    staffId: z.string().uuid(),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(1, "Repite la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type Target =
  | { ok: false; error: string }
  | {
      ok: true;
      businessId: string;
      staff: { id: string; invited_email: string | null; profile_id: string | null };
    };

/**
 * ¿Hay otra cuenta con ese correo? La API admin de Supabase responde a un
 * correo repetido con un genérico "Error updating user", sin código, así
 * que se comprueba antes para poder decirlo con claridad.
 */
async function emailTaken(email: string, exceptUserId: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).some(
    (u) => u.email?.toLowerCase() === email && u.id !== exceptUserId,
  );
}

async function loadTarget(staffId: string): Promise<Target> {
  const business = await getMyBusinessAsAdmin();
  if (!business) return { ok: false, error: "No autorizado." };

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff_members")
    .select("id, invited_email, profile_id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staff) return { ok: false, error: "No encontrado." };

  if (staff.profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role, business_id")
      .eq("id", staff.profile_id)
      .maybeSingle();
    if (profile?.role !== "staff" || profile.business_id !== business.id) {
      return {
        ok: false,
        error: "Esa es la cuenta del administrador: se cambia en Configuración → Mi cuenta.",
      };
    }
  }

  return { ok: true, businessId: business.id, staff };
}

export async function updateStaffEmail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse({
    staffId: formData.get("staffId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { staffId, email } = parsed.data;

  const target = await loadTarget(staffId);
  if (!target.ok) return { error: target.error };
  const { staff, businessId } = target;
  const admin = createAdminClient();

  // ── Ya tiene cuenta: el cambio se aplica al momento ──────────────────
  if (staff.profile_id) {
    const { data: current } = await admin.auth.admin.getUserById(staff.profile_id);
    if (current.user?.email?.toLowerCase() === email) {
      return { fieldErrors: { email: ["Ya es su correo actual"] } };
    }
    if (await emailTaken(email, staff.profile_id)) {
      return { fieldErrors: { email: ["Ese correo ya lo usa otra cuenta"] } };
    }
    // Sin correo de confirmación: lo cambia el admin, que responde por él.
    // Si se equivoca de dirección, lo corrige aquí mismo.
    const { error } = await admin.auth.admin.updateUserById(staff.profile_id, {
      email,
      email_confirm: true,
    });
    if (error) {
      if (error.code === "email_exists" || /already/i.test(error.message)) {
        return { fieldErrors: { email: ["Ese correo ya lo usa otra cuenta"] } };
      }
      console.error("[staff] email change:", error.message);
      return { error: "No se pudo cambiar el correo." };
    }
    // `invited_email` es el respaldo de los avisos por correo al staff.
    await admin.from("staff_members").update({ invited_email: email }).eq("id", staff.id);
    revalidatePath(`/dashboard/staff/${staff.id}`);
    revalidatePath("/dashboard/staff");
    return { message: `Listo. Desde ahora entra con ${email}.` };
  }

  // ── Sin cuenta todavía: (re)invitar al correo nuevo ──────────────────
  const previous = staff.invited_email;
  if (previous?.toLowerCase() === email) {
    return { fieldErrors: { email: ["Ya es el correo de la invitación; usa Reenviar"] } };
  }

  await admin.from("staff_members").update({ invited_email: email }).eq("id", staff.id);
  const inviteError = await inviteStaff(email, staff.id, businessId);
  if (inviteError) {
    // Sin invitación válida al correo nuevo, se conserva la anterior.
    await admin.from("staff_members").update({ invited_email: previous }).eq("id", staff.id);
    return { error: inviteError };
  }
  if (previous) await forgetPendingInvite(previous, staff.id);

  revalidatePath(`/dashboard/staff/${staff.id}`);
  revalidatePath("/dashboard/staff");
  return {
    message: previous
      ? `Invitación enviada a ${email}. El enlace anterior ya no sirve.`
      : `Invitación enviada a ${email}.`,
  };
}

export async function setStaffPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = passwordSchema.safeParse({
    staffId: formData.get("staffId"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const target = await loadTarget(parsed.data.staffId);
  if (!target.ok) return { error: target.error };
  const userId = target.staff.profile_id;
  if (!userId) {
    return { error: "Todavía no tiene cuenta: primero tiene que aceptar la invitación." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Contraseña demasiado débil"] } };
    }
    console.error("[staff] password change:", error.message);
    return { error: "No se pudo cambiar la contraseña." };
  }

  // Quien entró con la contraseña vieja queda fuera de todos sus dispositivos,
  // y deja de recibir avisos push en ellos hasta que vuelva a activarlos.
  await admin.from("push_subscriptions").delete().eq("profile_id", userId);
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
    p_user_id: userId,
  });
  if (revokeError) {
    console.error("[staff] revoke sessions:", revokeError.message);
    return {
      message:
        "Contraseña actualizada. No pudimos cerrar sus sesiones abiertas; seguirán activas hasta que salga.",
    };
  }

  return {
    message:
      "Contraseña actualizada y sesiones cerradas en todos sus dispositivos. Compártela por un medio seguro.",
  };
}
