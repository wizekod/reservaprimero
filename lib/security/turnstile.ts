/**
 * Verificación de Cloudflare Turnstile. Modo protegido: si falta
 * `TURNSTILE_SECRET_KEY`, se considera válido (skipped) para no bloquear el
 * flujo en desarrollo o antes de configurarlo.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false };

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
        }),
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return { ok: data.success === true };
  } catch {
    return { ok: false };
  }
}
