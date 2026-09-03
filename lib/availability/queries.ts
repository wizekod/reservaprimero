import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailability, type Slot } from "@/lib/availability/compute";

export type GetSlotsParams = {
  slug: string;
  serviceId: string;
  staffId?: string | null; // null/undefined = cualquier profesional disponible
  dateFrom: string; // "YYYY-MM-DD" (hora local del negocio)
  dateTo: string; // inclusive
  now?: Date;
  /** Cita a ignorar al calcular "ocupado" (para reagendar sin chocar consigo misma). */
  excludeAppointmentId?: string;
};

export type SlotsResult =
  | {
      ok: false;
      reason: "business_not_found" | "service_not_found" | "no_staff";
    }
  | { ok: true; slots: Slot[]; timeZone: string; slotIntervalMinutes: number };

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Calcula los slots reservables para la página pública. Corre server-side con
 * `service_role` porque necesita leer `appointments` (fuera del alcance de anon).
 * Solo devuelve instantes libres/ocupados, sin datos de las citas.
 */
export async function getSlots(p: GetSlotsParams): Promise<SlotsResult> {
  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select(
      "id, timezone, status, min_booking_notice_hours, max_booking_days, slot_interval_minutes",
    )
    .eq("slug", p.slug)
    .maybeSingle();
  if (!business || business.status === "suspended") {
    return { ok: false, reason: "business_not_found" };
  }

  const { data: service } = await admin
    .from("services")
    .select("id, duration_minutes, buffer_minutes, active")
    .eq("id", p.serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!service || !service.active) {
    return { ok: false, reason: "service_not_found" };
  }

  const { data: ssRows } = await admin
    .from("staff_services")
    .select("staff_member_id")
    .eq("service_id", p.serviceId);
  let candidateIds = (ssRows ?? []).map((r) => r.staff_member_id);
  if (p.staffId) candidateIds = candidateIds.filter((id) => id === p.staffId);
  if (candidateIds.length === 0) return { ok: false, reason: "no_staff" };

  const { data: staffRows } = await admin
    .from("staff_members")
    .select("id")
    .eq("business_id", business.id)
    .eq("active", true)
    .in("id", candidateIds);
  const staffIds = (staffRows ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { ok: false, reason: "no_staff" };

  const [{ data: rules }, { data: exceptions }] = await Promise.all([
    admin
      .from("availability_rules")
      .select("staff_member_id, day_of_week, start_time, end_time")
      .in("staff_member_id", staffIds),
    admin
      .from("availability_exceptions")
      .select("staff_member_id, date, is_closed, start_time, end_time")
      .in("staff_member_id", staffIds)
      .gte("date", p.dateFrom)
      .lte("date", p.dateTo),
  ]);

  // Margen de ±1-2 días para no perder citas cerca del borde por la tz.
  const busyFrom = new Date(`${p.dateFrom}T00:00:00Z`);
  busyFrom.setUTCDate(busyFrom.getUTCDate() - 1);
  const busyTo = new Date(`${p.dateTo}T00:00:00Z`);
  busyTo.setUTCDate(busyTo.getUTCDate() + 2);

  let apptQuery = admin
    .from("appointments")
    .select("id, staff_member_id, start_at, end_at")
    .in("staff_member_id", staffIds)
    .in("status", ["pending", "confirmed"])
    .gte("start_at", busyFrom.toISOString())
    .lt("start_at", busyTo.toISOString());
  if (p.excludeAppointmentId) {
    apptQuery = apptQuery.neq("id", p.excludeAppointmentId);
  }
  const { data: appts } = await apptQuery;

  const slots = computeAvailability({
    now: p.now ?? new Date(),
    timeZone: business.timezone,
    service: {
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
    },
    minBookingNoticeHours: business.min_booking_notice_hours,
    maxBookingDays: business.max_booking_days,
    slotIntervalMinutes: business.slot_interval_minutes,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    staffIds,
    rules: (rules ?? []).map((r) => ({
      staffMemberId: r.staff_member_id,
      dayOfWeek: r.day_of_week,
      start: hhmm(r.start_time),
      end: hhmm(r.end_time),
    })),
    exceptions: (exceptions ?? []).map((e) => ({
      staffMemberId: e.staff_member_id,
      date: e.date,
      isClosed: e.is_closed,
      start: e.start_time ? hhmm(e.start_time) : null,
      end: e.end_time ? hhmm(e.end_time) : null,
    })),
    busy: (appts ?? []).map((a) => ({
      staffMemberId: a.staff_member_id,
      startAt: a.start_at,
      endAt: a.end_at,
    })),
  });

  return {
    ok: true,
    slots,
    timeZone: business.timezone,
    slotIntervalMinutes: business.slot_interval_minutes,
  };
}
