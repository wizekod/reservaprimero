import type { SendResult } from "@/lib/notifications/email";

/**
 * Plantillas de WhatsApp que hay que dar de alta (categoría "Utility") en
 * Meta Business Manager con exactamente estos nombres. El valor es el número
 * de variables del cuerpo ({{1}}…{{n}}), en el orden en que se pasan. El
 * texto a registrar está en DEPLOY.md.
 */
export const WHATSAPP_TEMPLATES = {
  cita_confirmada: 6, // nombre, negocio, servicio, fecha, profesional, enlace
  cita_reagendada: 6, // idem
  cita_recordatorio: 6, // idem
  cita_cancelada: 4, // nombre, negocio, servicio, fecha
} as const;

export type WhatsAppTemplate = keyof typeof WHATSAPP_TEMPLATES;

// Cada versión de la Graph API vive unos dos años; subirla al caducar.
const GRAPH_VERSION = "v23.0";

/**
 * Destinatario en el formato que pide la Cloud API: sólo dígitos, con código
 * de país. Recibe `customers.phone_key` (E.164); devuelve null si no hay.
 */
export function toWhatsAppAddress(phoneKey: string | null | undefined): string | null {
  if (!phoneKey) return null;
  const digits = phoneKey.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Envío por WhatsApp vía la Cloud API de Meta (HTTP, sin SDK). Modo
 * protegido: si faltan credenciales se omite. Los mensajes que inicia el
 * negocio sólo pueden ser plantillas aprobadas, así que no hay texto libre.
 */
export async function sendWhatsApp(args: {
  to: string; // salida de toWhatsAppAddress
  template: WhatsAppTemplate;
  params: string[];
}): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { status: "skipped", reason: "credenciales de WhatsApp no configuradas" };
  }
  if (args.params.length !== WHATSAPP_TEMPLATES[args.template]) {
    return {
      status: "failed",
      error: `plantilla ${args.template}: se esperaban ${WHATSAPP_TEMPLATES[args.template]} variables`,
    };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.template,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es" },
      components: [
        {
          type: "body",
          // Meta rechaza variables vacías o con saltos de línea.
          parameters: args.params.map((p) => ({
            type: "text",
            text: p.replace(/\s+/g, " ").trim() || "-",
          })),
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      return { status: "failed", error: `WhatsApp ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as { messages?: { id?: string }[] };
    return { status: "sent", id: data.messages?.[0]?.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "error" };
  }
}
