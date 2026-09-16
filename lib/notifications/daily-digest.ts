import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { todayInTz, zonedDateAndMinutes } from "@/lib/availability/tz";

/**
 * Resumen diario de la agenda.
 *
 * Cada profesional recibe sus citas del día y el dueño las del negocio
 * entero. Es la alternativa a duplicarle al staff el recordatorio de 24h/2h de
 * cada cita: con ocho citas serían dieciséis mensajes, y lo que necesita es
 * una lista, no avisos sueltos.
 *
 * La idempotencia vive en `daily_digest_log`, no en `notifications_log`:
 * aquella tabla exige `appointment_id` y un resumen agrupa N citas.
 */

/**
 * Ventana desde la hora configurada. El cron corre cada 30 min, así que basta
 * con mirar si la hora local ya pasó; el log evita el duplicado.
 */
const WINDOW_MINUTES = 90;

type Cita = {
  start_at: string;
  status: string;
  staff_member_id: string;
  services: { name: string } | { name: string }[] | null;
  customers: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
};

const pick = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

export async function runDailyDigests(
  now: Date = new Date(),
): Promise<{ businesses: number; sent: number }> {
  const admin = createAdminClient();

  const { data: negocios } = await admin
    .from("businesses")
    .select("id, name, timezone, staff_digest_hour, notify_staff_on_booking, status")
    .neq("status", "suspended");

  let sent = 0;
  let considered = 0;

  for (const b of negocios ?? []) {
    considered += 1;

    const { minutes } = zonedDateAndMinutes(now.toISOString(), b.timezone);
    const desde = b.staff_digest_hour * 60;
    // Sólo dentro de la ventana que arranca a la hora configurada.
    if (minutes < desde || minutes >= desde + WINDOW_MINUTES) continue;

    const hoy = todayInTz(b.timezone, now);

    // ¿Ya se mandó hoy? Una consulta por negocio en vez de una por persona.
    const { data: yaEnviados } = await admin
      .from("daily_digest_log")
      .select("staff_member_id")
      .eq("business_id", b.id)
      .eq("local_date", hoy);
    const enviados = new Set(
      (yaEnviados ?? []).map((r) => r.staff_member_id ?? "owner"),
    );

    const desdeISO = new Date(`${hoy}T00:00:00Z`);
    const { data: citas } = await admin
      .from("appointments")
      .select(
        `start_at, status, staff_member_id,
         services ( name ),
         customers ( name, phone )`,
      )
      .eq("business_id", b.id)
      .in("status", ["confirmed", "pending"])
      .gte("start_at", new Date(desdeISO.getTime() - 36 * 3600_000).toISOString())
      .lt("start_at", new Date(desdeISO.getTime() + 60 * 3600_000).toISOString())
      .order("start_at");

    // Filtrado fino por fecha local: el rango de arriba es holgado a propósito
    // para que ninguna zona horaria se quede fuera.
    const deHoy = (citas ?? []).filter(
      (c) => zonedDateAndMinutes(c.start_at, b.timezone).date === hoy,
    );

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, display_name, invited_email, profile_id")
      .eq("business_id", b.id)
      .eq("active", true);

    const linea = (c: Cita) => {
      const hora = new Date(c.start_at).toLocaleTimeString("es", {
        timeZone: b.timezone,
        hour: "2-digit",
        minute: "2-digit",
      });
      const cliente = pick(c.customers);
      const servicio = pick(c.services);
      return `${hora} · ${servicio?.name ?? "—"} · ${cliente?.name ?? "—"}${
        cliente?.phone ? ` (${cliente.phone})` : ""
      }${c.status === "pending" ? " [sin confirmar]" : ""}`;
    };

    const fechaLarga = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    // ── Un resumen por profesional ──────────────────────────────────────
    if (b.notify_staff_on_booking) {
      for (const m of staff ?? []) {
        if (enviados.has(m.id)) continue;

        let email: string | null = m.invited_email;
        if (m.profile_id) {
          const { data: u } = await admin.auth.admin.getUserById(m.profile_id);
          email = u.user?.email ?? email;
        }
        if (!email) continue;

        const suyas = deHoy.filter((c) => c.staff_member_id === m.id);
        if (suyas.length === 0) continue; // sin citas no se molesta a nadie

        const r = await sendEmail({
          to: email,
          subject: `[${b.name}] Tu agenda de hoy · ${suyas.length} cita${suyas.length === 1 ? "" : "s"}`,
          text:
            `${m.display_name}, tu agenda del ${fechaLarga}:\n\n` +
            suyas.map((c) => linea(c as Cita)).join("\n"),
        });
        // Se registra aunque el envío se omita por falta de credenciales: lo
        // que se evita es reintentar el mismo resumen cada media hora.
        await admin.from("daily_digest_log").insert({
          business_id: b.id,
          staff_member_id: m.id,
          local_date: hoy,
        });
        if (r.status === "sent") sent += 1;
      }
    }

    // ── Resumen del negocio para el dueño ───────────────────────────────
    if (!enviados.has("owner") && deHoy.length > 0) {
      const { data: owner } = await admin
        .from("profiles")
        .select("id")
        .eq("business_id", b.id)
        .eq("role", "business_admin")
        .limit(1)
        .maybeSingle();

      if (owner) {
        const { data: u } = await admin.auth.admin.getUserById(owner.id);
        const email = u.user?.email;
        if (email) {
          const nombres = new Map(
            (staff ?? []).map((m) => [m.id, m.display_name]),
          );
          const r = await sendEmail({
            to: email,
            subject: `[${b.name}] Agenda de hoy · ${deHoy.length} cita${deHoy.length === 1 ? "" : "s"}`,
            text:
              `Agenda del ${fechaLarga}:\n\n` +
              deHoy
                .map(
                  (c) =>
                    `${linea(c as Cita)} — ${nombres.get(c.staff_member_id) ?? "—"}`,
                )
                .join("\n"),
          });
          await admin.from("daily_digest_log").insert({
            business_id: b.id,
            staff_member_id: null,
            local_date: hoy,
          });
          if (r.status === "sent") sent += 1;
        }
      }
    }
  }

  return { businesses: considered, sent };
}
