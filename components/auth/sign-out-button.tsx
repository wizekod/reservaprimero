"use client";

import { signOut } from "@/app/(auth)/actions";
import { removePushSubscription } from "@/lib/push/actions";
import { pushSupported } from "@/lib/pwa/push-client";
import { Button } from "@/components/ui/button";

/**
 * Antes de salir se da de baja este dispositivo de las notificaciones: en
 * una computadora compartida, los avisos de esta cuenta no deben seguir
 * llegando a quien la use después.
 */
async function forgetThisDevice() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // Si falla, se cierra la sesión igual; el endpoint se reasigna cuando
    // otra cuenta active las notificaciones en este navegador.
  }
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        await forgetThisDevice();
        await signOut();
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Cerrar sesión
      </Button>
    </form>
  );
}
