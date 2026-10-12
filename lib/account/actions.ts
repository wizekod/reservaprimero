"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { clientEnv } from "@/lib/env";
import type { FormState } from "@/lib/forms";

/**
 * "Mi cuenta": datos de acceso del usuario logueado, sea admin, staff o
 * superadmin. Cambiar correo o contraseña pide la contraseña actual: con una
 * sesión robada (un ordenador sin bloquear) no basta para quedarse la cuenta.
 */

const nameSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa tu nombre").max(100, "Máximo 100 caracteres"),
});

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(1, "Repite la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

/**
 * Comprueba la contraseña con un cliente aparte, sin cookies, para no tocar
 * la sesión del navegador. La sesión que abre se revoca enseguida (`local`:
 * sólo esa; `global` cerraría también la del usuario).
 */
async function passwordMatches(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}

export async function updateAccountName(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = nameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);
  if (error) return { error: "No se pudo guardar el nombre." };

  // El nombre sale en la barra lateral de todos los paneles.
  revalidatePath("/", "layout");
  return { message: "Nombre actualizado." };
}

export async function requestEmailChange(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user?.email) redirect("/login");

  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, currentPassword } = parsed.data;

  if (email === user.email.toLowerCase()) {
    return { fieldErrors: { email: ["Ya es tu correo actual"] } };
  }
  if (!(await passwordMatches(user.email, currentPassword))) {
    return { fieldErrors: { currentPassword: ["Contraseña incorrecta"] } };
  }

  // El cambio no se aplica hasta que se confirma el enlace del correo (en
  // los dos buzones si Supabase tiene activado "Secure email change").
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    {
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
    },
  );
  if (error) {
    if (error.code === "email_exists") {
      return { fieldErrors: { email: ["Ese correo ya lo usa otra cuenta"] } };
    }
    // Supabase escribe al correo nuevo (y al actual con "Secure email
    // change"); si el SMTP lo rechaza, el cambio no llega a registrarse.
    if (error.code === "email_address_invalid" || error.code === "email_address_not_authorized") {
      console.error("[account] email change:", error.message);
      return { error: "No pudimos enviar el correo de confirmación. Revisa que la dirección exista o inténtalo más tarde." };
    }
    if (error.status === 429) {
      return { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." };
    }
    console.error("[account] email change:", error.message);
    return { error: "No se pudo iniciar el cambio de correo." };
  }

  revalidatePath("/", "layout");
  return {
    message: `Te enviamos un enlace a ${email}. El cambio se aplica cuando lo abras; si también te llega un correo a tu dirección actual, confírmalo ahí.`,
  };
}

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user?.email) redirect("/login");

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { currentPassword, password } = parsed.data;

  if (!(await passwordMatches(user.email, currentPassword))) {
    return { fieldErrors: { currentPassword: ["Contraseña incorrecta"] } };
  }
  if (password === currentPassword) {
    return { fieldErrors: { password: ["Debe ser distinta de la actual"] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Contraseña demasiado débil"] } };
    }
    console.error("[account] password change:", error.message);
    return { error: "No se pudo cambiar la contraseña." };
  }

  // Quien tuviera la contraseña vieja queda fuera de los otros dispositivos;
  // esta sesión sigue abierta.
  await supabase.auth.signOut({ scope: "others" });

  return { message: "Contraseña actualizada. Se cerró la sesión en tus otros dispositivos." };
}
