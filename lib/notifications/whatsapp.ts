import type { SendResult } from "@/lib/notifications/email";

/** Normaliza a formato E.164 con prefijo `whatsapp:`. Devuelve null si no parece un número válido. */
export function toWhatsAppAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return null;
  const e164 = digits.startsWith("+") ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

/**
 * Envío por WhatsApp vía Twilio (HTTP, sin SDK). Modo protegido: si faltan
 * credenciales se omite. Para producción fuera de la ventana de 24h se
 * necesita `contentSid` (plantilla aprobada) — el `body` es el fallback.
 */
export async function sendWhatsApp(args: {
  to: string; // salida de toWhatsAppAddress
  body: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!sid || !token || !from) {
    return { status: "skipped", reason: "credenciales de Twilio no configuradas" };
  }

  const form = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: args.to,
  });
  if (args.contentSid) {
    form.set("ContentSid", args.contentSid);
    if (args.contentVariables) {
      form.set("ContentVariables", JSON.stringify(args.contentVariables));
    }
  } else {
    form.set("Body", args.body);
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    if (!res.ok) {
      return { status: "failed", error: `Twilio ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as { sid?: string };
    return { status: "sent", id: data.sid };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "error" };
  }
}
