"use server";

import { z } from "zod";

import { getUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/notifications/push";

/**
 * Alta y baja de dispositivos para las notificaciones push del equipo.
 *
 * El alta va con service_role: si el navegador ya estaba suscrito con otra
 * cuenta (computadora compartida), el endpoint tiene que cambiar de dueño, y
 * esa fila el usuario actual no la ve por RLS. La identidad sale de la
 * sesión, nunca del cliente.
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

type Result = { ok: true } | { ok: false; error: string };

export async function savePushSubscription(
  subscription: unknown,
  userAgent: string | null,
): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesión expirada" };

  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "Suscripción inválida" };
  const { endpoint, keys } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[push] save:", error.message);
    return { ok: false, error: "No se pudo guardar el dispositivo" };
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesión expirada" };

  // Con la sesión del usuario: la RLS sólo le deja borrar los suyos.
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: "No se pudo desactivar" };
  return { ok: true };
}

export async function sendTestPush(): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesión expirada" };

  const r = await sendPushToUser(user.id, {
    title: "ReservaPrimero",
    body: "Las notificaciones funcionan en este dispositivo.",
    url: "/dashboard",
    tag: "prueba",
  });
  if (r.status === "sent") return { ok: true };
  if (r.status === "failed") {
    console.error("[push] test:", r.error);
    return { ok: false, error: "El servicio de notificaciones rechazó el envío" };
  }
  return {
    ok: false,
    error:
      r.reason === "VAPID no configurado"
        ? "Las notificaciones aún no están configuradas en el servidor"
        : "No hay ningún dispositivo activado",
  };
}
