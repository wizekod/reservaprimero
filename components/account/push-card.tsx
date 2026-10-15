"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";

import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/push/actions";
import {
  VAPID_PUBLIC_KEY,
  isIos,
  isStandalone,
  pushSupported,
  registerServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/pwa/push-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status =
  | "loading"
  | "unconfigured" // faltan las llaves VAPID en el servidor
  | "ios-install" // iPhone sin la web app en la pantalla de inicio
  | "unsupported"
  | "denied"
  | "off"
  | "on";

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  return reg.pushManager.getSubscription();
}

function detect(): Promise<Status> | Status {
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (!pushSupported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return currentSubscription().then((s) =>
    s && Notification.permission === "granted" ? "on" : "off",
  );
}

/** Activar o desactivar las notificaciones push en este dispositivo. */
export function PushCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    Promise.resolve(detect())
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        // Tiene que pedirse dentro del toque: Safari ignora la petición si
        // no viene de un gesto del usuario.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await registerServiceWorker();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const r = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setStatus("on");
        toast.success("Notificaciones activadas en este dispositivo.");
      } catch (e) {
        console.error("[push] enable:", e);
        toast.error("No se pudieron activar las notificaciones.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const sub = await currentSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setStatus("off");
        toast.success("Notificaciones desactivadas en este dispositivo.");
      } catch {
        toast.error("No se pudieron desactivar.");
      }
    });
  }

  function test() {
    startTransition(async () => {
      const r = await sendTestPush();
      if (r.ok) toast.success("Enviada. Debería llegarte en unos segundos.");
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" />
          Notificaciones en este dispositivo
        </CardTitle>
        <CardDescription>
          Te avisamos al momento de cada cita nueva, cancelada o reagendada, y
          cada mañana con tu agenda del día. Actívalas en cada teléfono o
          computadora donde las quieras.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {status === "loading" ? (
          <p className="text-muted-foreground">Comprobando…</p>
        ) : null}
        {status === "unconfigured" ? (
          <p className="text-muted-foreground">
            Las notificaciones aún no están disponibles. Mientras tanto te
            avisamos por correo.
          </p>
        ) : null}
        {status === "unsupported" ? (
          <p className="text-muted-foreground">
            Este navegador no admite notificaciones. Prueba con Chrome, Edge,
            Firefox o Safari actualizados. Los avisos te siguen llegando por
            correo.
          </p>
        ) : null}
        {status === "denied" ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
            Las notificaciones están bloqueadas para ReservaPrimero. Permítelas
            en los ajustes del navegador (el candado junto a la dirección) o,
            en iPhone, en Ajustes → Notificaciones → ReservaPrimero, y vuelve a
            esta página.
          </p>
        ) : null}
        {status === "ios-install" ? (
          <div className="grid gap-2 rounded-md bg-accent px-3 py-3 text-accent-foreground">
            <p className="font-medium">En iPhone, primero instala la app:</p>
            <ol className="grid list-decimal gap-1.5 pl-5">
              <li>
                Abre esta página en <strong>Safari</strong>.
              </li>
              <li>
                Toca <Share className="inline size-4 align-text-bottom" />{" "}
                <strong>Compartir</strong> y luego{" "}
                <SquarePlus className="inline size-4 align-text-bottom" />{" "}
                <strong>Agregar a pantalla de inicio</strong>.
              </li>
              <li>
                Abre ReservaPrimero desde el ícono nuevo, entra a{" "}
                <strong>Mi cuenta</strong> y toca <strong>Activar</strong>.
              </li>
            </ol>
            <p className="text-xs opacity-80">Necesitas iOS 16.4 o más reciente.</p>
          </div>
        ) : null}
        {status === "on" ? (
          <p className="rounded-md bg-accent px-3 py-2 text-accent-foreground">
            Activadas en este dispositivo.
          </p>
        ) : null}
      </CardContent>
      {status === "off" || status === "on" ? (
        <CardFooter className="flex flex-wrap gap-2">
          {status === "off" ? (
            <Button onClick={enable} disabled={pending}>
              {pending ? "Activando…" : "Activar notificaciones"}
            </Button>
          ) : (
            <>
              <Button onClick={test} disabled={pending} variant="outline">
                Enviar una de prueba
              </Button>
              <Button onClick={disable} disabled={pending} variant="ghost">
                Desactivar
              </Button>
            </>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
