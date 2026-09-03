import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Objetivo de los enlaces de correo (invitación de staff, confirmación de
 * cuenta, recuperación). Acepta `token_hash`+`type` (verifyOtp) o `code`
 * (PKCE). Redirige a `next` (ruta interna).
 *
 * Plantillas de correo de Supabase → enlazar a:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/definir-clave
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
