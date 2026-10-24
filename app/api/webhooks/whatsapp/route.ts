import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Webhook de la Cloud API de Meta. Meta lo exige para pasar la app a
 * producción; los envíos no dependen de él.
 *
 * GET: verificación al darlo de alta (devuelve `hub.challenge` si el token
 * coincide con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
 * POST: avisos de entrega y mensajes entrantes. Por ahora sólo se registran
 * en los logs los mensajes que Meta no pudo entregar.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === expected
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type StatusEvent = {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string }[];
};

export async function POST(request: Request) {
  const body = await request.text();

  // Con el App Secret configurado, se rechaza lo que no venga firmado por Meta.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response("firma inválida", { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(body) as {
      entry?: { changes?: { value?: { statuses?: StatusEvent[] } }[] }[];
    };
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          if (s.status === "failed") {
            const e = s.errors?.[0];
            console.error(
              `[whatsapp] no entregado ${s.id ?? ""}: ${e?.code ?? ""} ${e?.title ?? ""}`,
            );
          }
        }
      }
    }
  } catch {
    // Cuerpo no JSON: se responde 200 igual para que Meta no reintente.
  }

  // Meta reintenta durante días si no recibe 200.
  return new Response("ok", { status: 200 });
}
