import { runReminders } from "@/lib/notifications/reminders";
import { runDailyDigests } from "@/lib/notifications/daily-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tareas programadas: recordatorios de cita al cliente y resumen diario de
 * agenda al equipo.
 *
 * Van en la misma ruta y no en dos crons distintos porque el plan Hobby de
 * Vercel limita el número de crons, y la cadencia de 30 min ya sirve para
 * ambas: los recordatorios abren una ventana de 35 min y el resumen sólo
 * comprueba si la hora local del negocio cruzó la hora configurada.
 *
 * Vercel envía `Authorization: Bearer $CRON_SECRET`. En local sin
 * `CRON_SECRET` se permite; en producción sin secreto configurado, se rechaza.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new Response("CRON_SECRET no configurado", { status: 401 });
  }

  const reminders = await runReminders();
  const digests = await runDailyDigests();
  return Response.json({
    ok: true,
    reminders,
    digests,
    at: new Date().toISOString(),
  });
}
