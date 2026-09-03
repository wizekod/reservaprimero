type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type SendResult =
  | { status: "sent"; id?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Envío de email vía Resend (HTTP, sin SDK). Si falta `RESEND_API_KEY` se
 * omite en silencio (modo protegido): el resto del flujo no se rompe.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    return { status: "skipped", reason: "RESEND_API_KEY/RESEND_FROM_EMAIL no configurados" };
  }
  if (!args.to) return { status: "skipped", reason: "sin destinatario" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html ?? `<p>${escapeHtml(args.text).replace(/\n/g, "<br>")}</p>`,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      return { status: "failed", error: `Resend ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as { id?: string };
    return { status: "sent", id: data.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "error" };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
