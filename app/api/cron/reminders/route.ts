import { runReminders } from "@/lib/notifications/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ejecutado por Vercel Cron (ver vercel.json). Vercel envía
 * `Authorization: Bearer $CRON_SECRET`. En local sin `CRON_SECRET` se permite;
 * en producción sin secreto configurado, se rechaza.
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

  const result = await runReminders();
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}
