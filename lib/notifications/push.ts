import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SendResult } from "@/lib/notifications/email";

/**
 * Notificaciones push (Web Push) para el equipo: dueño y staff.
 *
 * Sustituyen a WhatsApp para los avisos internos porque no cuestan nada por
 * mensaje. Llegan al navegador en Android y computadora, y en iPhone sólo
 * con la web app agregada a la pantalla de inicio (iOS 16.4+).
 *
 * Modo protegido: sin las llaves VAPID no se envía nada y el flujo sigue.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta del panel que se abre al tocar el aviso. */
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en vez de apilarse. */
  tag?: string;
};

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "https://reservaprimero.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return configure();
}

/**
 * Envía el aviso a todos los dispositivos de un usuario. Cuenta como enviado
 * si llegó al menos a uno. Los dispositivos que el servicio push da por
 * muertos (404/410) se borran para no reintentarlos.
 */
export async function sendPushToUser(
  profileId: string | null,
  payload: PushPayload,
): Promise<SendResult> {
  if (!configure()) {
    return { status: "skipped", reason: "VAPID no configurado" };
  }
  if (!profileId) return { status: "skipped", reason: "sin destinatario" };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);
  if (!subs?.length) {
    return { status: "skipped", reason: "sin dispositivos suscritos" };
  }

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const errors: string[] = [];
  let delivered = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        delivered += 1;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          dead.push(s.id);
        } else {
          errors.push(`${code ?? "?"}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    }),
  );

  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  if (delivered > 0) return { status: "sent" };
  if (errors.length) return { status: "failed", error: errors.join("; ") };
  return { status: "skipped", reason: "dispositivos caducados" };
}
