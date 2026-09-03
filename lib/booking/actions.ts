"use server";

import { after } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingCreated } from "@/lib/notifications/dispatch";
import { clientEnv } from "@/lib/env";
import { getSlots } from "@/lib/availability/queries";
import { todayInTz, addDays } from "@/lib/availability/tz";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { isWithinMonthlyBookingLimit } from "@/lib/stripe/plan-limit";

export type BookableStaff = { id: string; display_name: string };

async function resolveBusiness(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("businesses")
    .select(
      "id, timezone, status, auto_confirm_bookings, min_booking_notice_hours, max_booking_days",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status === "suspended") return null;
  return data;
}

/** Profesionales activos que realizan el servicio. */
export async function getBookableStaff(
  slug: string,
  serviceId: string,
): Promise<BookableStaff[]> {
  const business = await resolveBusiness(slug);
  if (!business) return [];

  const admin = createAdminClient();
  const { data: ss } = await admin
    .from("staff_services")
    .select("staff_member_id")
    .eq("service_id", serviceId);
  const ids = (ss ?? []).map((r) => r.staff_member_id);
  if (ids.length === 0) return [];

  const { data: staff } = await admin
    .from("staff_members")
    .select("id, display_name")
    .eq("business_id", business.id)
    .eq("active", true)
    .in("id", ids)
    .order("display_name");
  return staff ?? [];
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchSlots(
  slug: string,
  serviceId: string,
  staffId: string | null,
  date: string,
) {
  if (!dateRe.test(date)) return { ok: false as const, reason: "bad_date" };

  if (!rateLimit(`slots:${await clientIp()}`, 120, 60_000).ok) {
    return { ok: false as const, reason: "rate_limited" };
  }

  const business = await resolveBusiness(slug);
  if (!business) return { ok: false as const, reason: "business_not_found" };

  const today = todayInTz(business.timezone);
  const maxDate = addDays(today, business.max_booking_days);
  if (date < today || date > maxDate) {
    return { ok: true as const, slots: [], timeZone: business.timezone, slotIntervalMinutes: 0 };
  }

  return getSlots({ slug, serviceId, staffId: staffId ?? undefined, dateFrom: date, dateTo: date });
}

const bookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  startISO: z.string().datetime(),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  phone: z.string().trim().min(6, "Teléfono inválido").max(30),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().toLowerCase().email("Correo inválido").optional(),
  ),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  turnstileToken: z.string().optional(),
});

export type CreateBookingInput = z.input<typeof bookingSchema>;

export type CreateBookingResult =
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
  | { ok: true; status: "confirmed" | "pending"; token: string; manageUrl: string };

export async function createBooking(
  raw: CreateBookingInput,
): Promise<CreateBookingResult> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const b = parsed.data;

  const ip = await clientIp();
  if (!rateLimit(`booking:${ip}`, 6, 60_000).ok) {
    return { ok: false, error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." };
  }
  const ts = await verifyTurnstile(b.turnstileToken, ip);
  if (!ts.ok) {
    return { ok: false, error: "No pudimos verificar que no eres un bot. Recarga la página." };
  }

  // TODO(plan): si el negocio está en plan Free, bloquear si supera el límite mensual.

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id, timezone, status, auto_confirm_bookings")
    .eq("slug", b.slug)
    .maybeSingle();
  if (!business || business.status === "suspended") {
    return { ok: false, error: "Negocio no disponible." };
  }

  if (!(await isWithinMonthlyBookingLimit(business.id, business.timezone))) {
    return {
      ok: false,
      error: "Este negocio alcanzó su límite de reservas para este mes.",
    };
  }

  const { data: service } = await admin
    .from("services")
    .select("id, duration_minutes, active")
    .eq("id", b.serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!service || !service.active) {
    return { ok: false, error: "Servicio no disponible." };
  }

  const { data: staff } = await admin
    .from("staff_members")
    .select("id")
    .eq("id", b.staffMemberId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  const { data: doesService } = await admin
    .from("staff_services")
    .select("service_id")
    .eq("staff_member_id", b.staffMemberId)
    .eq("service_id", b.serviceId)
    .maybeSingle();
  if (!staff || !doesService) {
    return { ok: false, error: "Ese profesional no está disponible para el servicio." };
  }

  // Revalidación server-side del slot exacto.
  const date = todayInTz(business.timezone, new Date(b.startISO));
  const avail = await getSlots({
    slug: b.slug,
    serviceId: b.serviceId,
    staffId: b.staffMemberId,
    dateFrom: date,
    dateTo: date,
  });
  const startISO = new Date(b.startISO).toISOString();
  if (
    !avail.ok ||
    !avail.slots.some(
      (s) => s.staffMemberId === b.staffMemberId && s.start === startISO,
    )
  ) {
    return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };
  }

  const endISO = new Date(
    new Date(startISO).getTime() + service.duration_minutes * 60_000,
  ).toISOString();

  // find-or-create del cliente dentro del negocio.
  const phone = b.phone.replace(/[^\d+]/g, "");
  const orFilter = b.email
    ? `phone.eq.${phone},email.eq.${b.email}`
    : `phone.eq.${phone}`;
  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", business.id)
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.id;
  if (!customerId) {
    const { data: created, error: custError } = await admin
      .from("customers")
      .insert({
        business_id: business.id,
        name: b.name,
        phone,
        email: b.email ?? null,
      })
      .select("id")
      .single();
    if (custError || !created) {
      return { ok: false, error: "No se pudo registrar tus datos." };
    }
    customerId = created.id;
  }

  const status = business.auto_confirm_bookings ? "confirmed" : "pending";

  const { data: appointment, error: apptError } = await admin
    .from("appointments")
    .insert({
      business_id: business.id,
      service_id: b.serviceId,
      staff_member_id: b.staffMemberId,
      customer_id: customerId,
      start_at: startISO,
      end_at: endISO,
      status,
      notes: b.notes ?? null,
    })
    .select("id, cancel_token, status")
    .single();

  if (apptError || !appointment) {
    if (apptError?.code === "23P01") {
      return { ok: false, error: "Ese horario acaba de ocuparse. Elige otro." };
    }
    return { ok: false, error: "No se pudo crear la reserva." };
  }

  after(() => notifyBookingCreated(appointment.id));

  return {
    ok: true,
    status: appointment.status as "confirmed" | "pending",
    token: appointment.cancel_token,
    manageUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}/reservas/${appointment.cancel_token}`,
  };
}
