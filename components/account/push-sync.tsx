"use client";

import { useEffect } from "react";

import { savePushSubscription } from "@/lib/push/actions";
import {
  VAPID_PUBLIC_KEY,
  pushSupported,
  registerServiceWorker,
} from "@/lib/pwa/push-client";

const KEY = "rp-push-synced";

/**
 * Al abrir el panel, vuelve a guardar la suscripción de este dispositivo si
 * ya tenía permiso. Cubre dos casos sin que el usuario haga nada: el
 * navegador rotó el endpoint, o en esta computadora inició sesión otra
 * cuenta y los avisos tienen que pasar a ella. Una vez por sesión.
 */
export function PushSync() {
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !pushSupported()) return;
    if (Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      // Sin sessionStorage se sincroniza en cada carga; no pasa nada.
    }

    registerServiceWorker()
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return;
        const r = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (r.ok) {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
