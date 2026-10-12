import { runReminders } from "@/lib/notifications/reminders";
import { runDailyDigests } from "@/lib/notifications/daily-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tareas programadas: recordatorios de cita al cliente y resumen diario de
 * agenda al equipo.
 *
 * Las dispara cada 30 min pg_cron desde Supabase (migración
 * `reminders_pg_cron`), no Vercel Cron: el plan Hobby sólo admite crons
 * diarios. La misma cadencia sirve para ambas: los recordatorios abren una
 * ventana de 35 min y el resumen sólo comprueba si la hora local del negocio
 * cruzó la hora configurada.
 *
 * Se exige `Authorization: Bearer $CRON_SECRET`. En local sin `CRON_SECRET`
 * se permite; en producción sin secreto configurado, se rechaza.
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
