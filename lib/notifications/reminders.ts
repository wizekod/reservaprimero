import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReminder } from "@/lib/notifications/dispatch";

/** Minutos antes de la cita en que se envía cada recordatorio (CLAUDE.md §8). */
export const REMINDER_OFFSETS = [1440, 120] as const;

/** Ventana de captura: debe cubrir el intervalo entre ejecuciones del cron. */
const WINDOW_MINUTES = 35;

/**
 * Revisa las citas próximas y dispara los recordatorios pendientes.
 * `notifyReminder` hace su propio dedupe (`notifications_log`), así que es
 * seguro re-ejecutar.
 */
export async function runReminders(now: Date = new Date()) {
  const admin = createAdminClient();
  const perOffset: Record<number, number> = {};
  let processed = 0;

  for (const offset of REMINDER_OFFSETS) {
    const from = new Date(now.getTime() + offset * 60_000);
    const to = new Date(now.getTime() + (offset + WINDOW_MINUTES) * 60_000);

    const { data: appts } = await admin
      .from("appointments")
      .select("id")
      .in("status", ["confirmed", "pending"])
      .gte("start_at", from.toISOString())
      .lt("start_at", to.toISOString());

    for (const a of appts ?? []) {
      await notifyReminder(a.id, offset);
      processed += 1;
      perOffset[offset] = (perOffset[offset] ?? 0) + 1;
    }
  }

  return { processed, perOffset };
}
