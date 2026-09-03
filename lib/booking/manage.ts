import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AppointmentStatus } from "@/lib/supabase/database.types";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManagedAppointment = {
  id: string;
  token: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  staffMemberId: string;
  staffName: string;
  businessName: string;
  businessSlug: string;
  timeZone: string;
  cancellationNoticeHours: number;
  maxBookingDays: number;
  /** Se puede cancelar/reagendar: sigue activa y estamos fuera de la ventana de aviso. */
  canModify: boolean;
};

type Nested<T> = T | T[] | null;
const pick = <T,>(v: Nested<T>): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

export async function getAppointmentByToken(
  token: string,
): Promise<ManagedAppointment | null> {
  if (!TOKEN_RE.test(token)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select(
      `id, status, start_at, end_at, cancel_token, service_id, staff_member_id,
       services ( name, duration_minutes ),
       staff_members ( display_name ),
       businesses ( name, slug, timezone, cancellation_notice_hours, max_booking_days )`,
    )
    .eq("cancel_token", token)
    .maybeSingle();

  if (!data) return null;
  const service = pick(data.services);
  const staff = pick(data.staff_members);
  const business = pick(data.businesses);
  if (!service || !staff || !business) return null;

  const noticeMs = business.cancellation_notice_hours * 3_600_000;
  const canModify =
    (data.status === "pending" || data.status === "confirmed") &&
    Date.now() < new Date(data.start_at).getTime() - noticeMs;

  return {
    id: data.id,
    token: data.cancel_token,
    status: data.status,
    startAt: data.start_at,
    endAt: data.end_at,
    serviceId: data.service_id,
    serviceName: service.name,
    serviceDurationMinutes: service.duration_minutes,
    staffMemberId: data.staff_member_id,
    staffName: staff.display_name,
    businessName: business.name,
    businessSlug: business.slug,
    timeZone: business.timezone,
    cancellationNoticeHours: business.cancellation_notice_hours,
    maxBookingDays: business.max_booking_days,
    canModify,
  };
}
