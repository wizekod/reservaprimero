"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";
import { roleHome } from "@/lib/auth/roles";
import { slugify, validateSlug } from "@/lib/businesses/slug";
import type { UserRole } from "@/lib/supabase/database.types";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

const emailField = z.string().trim().toLowerCase().email("Correo inválido");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Ingresa tu contraseña"),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa tu nombre"),
  email: emailField,
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

/** Sólo permite rutas internas relativas como destino post-login. */
function safeNext(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, business_id")
    .eq("id", data.user.id)
    .maybeSingle();

  const role: UserRole = profile?.role ?? "business_admin";
  const next = safeNext(formData.get("next"));
  if (next) redirect(next);
  if (role === "business_admin" && !profile?.business_id) redirect("/onboarding");
  redirect(roleHome(role));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  // Enlace elegido en la landing: sólo una sugerencia para el onboarding,
  // que vuelve a validar disponibilidad al crear el negocio.
  const rawSlug = formData.get("desiredSlug");
  const desiredSlug =
    typeof rawSlug === "string" && validateSlug(slugify(rawSlug)).ok
      ? slugify(rawSlug)
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, ...(desiredSlug ? { desired_slug: desiredSlug } : {}) },
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // "Confirm email" activado en Supabase → sin sesión hasta confirmar.
  if (!data.session) {
    return {
      message:
        "Te enviamos un correo para confirmar tu cuenta. Ábrelo para continuar.",
    };
  }

  redirect("/onboarding");
}

const resetSchema = z.object({ email: emailField });

/**
 * Envía el correo para restablecer la contraseña. El enlace inicia sesión y
 * lleva a /auth/definir-clave.
 *
 * La respuesta es la misma exista o no la cuenta: si no, el formulario
 * serviría para averiguar qué correos están registrados.
 */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/definir-clave`,
  });
  if (error?.status === 429) {
    return { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." };
  }
  if (error) console.error("requestPasswordReset:", error.message);

  return {
    message:
      "Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
