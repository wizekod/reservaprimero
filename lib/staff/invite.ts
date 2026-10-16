import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";

/**
 * Fuera de los archivos "use server" a propósito: todo lo que exporta uno de
 * ellos es invocable desde el navegador, y esto manda correos con
 * service_role sin comprobar quién lo pide. Lo llaman acciones que ya
 * validaron que el usuario es admin del negocio.
 */

const INVITE_REDIRECT = `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/auth/definir-clave`;

/**
 * Invita (o re-invita si hay un usuario pendiente sin sesión previa).
 * Devuelve el mensaje de error o `null`.
 */
export async function inviteStaff(
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

/**
 * Borra la cuenta pendiente que creó una invitación a `email` si nunca se
 * usó y es de este profesional. Al cambiar el correo de una invitación, el
 * enlace viejo ya no enlazaría (setInitialPassword compara con
 * `invited_email`), pero la cuenta huérfana bloquearía ese correo para
 * siempre.
 */
export async function forgetPendingInvite(
  email: string,
  staffMemberId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const pending = list?.users?.find(
    (u) =>
      u.email?.toLowerCase() === email.toLowerCase() &&
      !u.last_sign_in_at &&
      u.user_metadata?.staff_member_id === staffMemberId,
  );
  if (pending) await admin.auth.admin.deleteUser(pending.id);
}
