"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";
import { getSlots } from "@/lib/availability/queries";
import { todayInTz } from "@/lib/availability/tz";
import { emptyToUndefined } from "@/lib/forms";
import {
  notifyBookingCancelled,
  notifyBookingConfirmed,
} from "@/lib/notifications/dispatch";

type Result = { ok: boolean; error?: string };

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function updateAppointmentStatus(
  id: string,
  next: AppointmentStatus,
): Promise<Result> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Cita no encontrada." };

  if (!ALLOWED[current.status].includes(next)) {
    return { ok: false, error: "Cambio de estado no permitido." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: next })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  if (next === "confirmed") after(() => notifyBookingConfirmed(id));
  if (next === "cancelled") after(() => notifyBookingCancelled(id));

  revalidatePath("/dashboard/calendario");
  revalidatePath("/staff");
  return { ok: true };
}

// ── Alta manual de cita desde el panel ──────────────────────────────────

const adminBookingSchema = z.object({
  serviceId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  startISO: z.string().datetime(),
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  phone: z.string().trim().min(6, "Teléfono inválido").max(30),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().toLowerCase().email("Correo inválido").optional(),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export type AdminBookingInput = z.input<typeof adminBookingSchema>;

export type AdminBookingResult =
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
  | { ok: true; date: string };

/**
 * El admin crea una cita a mano. Revalida el hueco server-side igual que la
 * reserva pública, pero sin Turnstile / rate limit / límite de plan, y la cita
 * nace `confirmed`.
 */
export async function createAppointmentAsAdmin(
  raw: AdminBookingInput,
): Promise<AdminBookingResult> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const parsed = adminBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const b = parsed.data;
  const admin = createAdminClient();

  const { data: service } = await admin
    .from("services")
    .select("id, duration_minutes, active")
    .eq("id", b.serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!service?.active) return { ok: false, error: "Servicio no disponible." };

  const { data: staff } = await admin
    .from("staff_members")
    .select("id")
    .eq("id", b.staffMemberId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (!staff) return { ok: false, error: "Profesional no disponible." };

  const startISO = new Date(b.startISO).toISOString();
  const date = todayInTz(business.timezone, new Date(startISO));

  const avail = await getSlots({
    slug: business.slug,
    serviceId: b.serviceId,
    staffId: b.staffMemberId,
    dateFrom: date,
    dateTo: date,
  });
  if (
    !avail.ok ||
    !avail.slots.some(
      (s) => s.staffMemberId === b.staffMemberId && s.start === startISO,
    )
  ) {
    return { ok: false, error: "Ese horario ya no está disponible." };
  }

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
    const { data: created, error } = await admin
      .from("customers")
      .insert({
        business_id: business.id,
        name: b.name,
        phone,
        email: b.email ?? null,
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: "No se pudo registrar al cliente." };
    }
    customerId = created.id;
  }

  const endISO = new Date(
    new Date(startISO).getTime() + service.duration_minutes * 60_000,
  ).toISOString();

  const { data: appointment, error: apptError } = await admin
    .from("appointments")
    .insert({
      business_id: business.id,
      service_id: b.serviceId,
      staff_member_id: b.staffMemberId,
      customer_id: customerId,
      start_at: startISO,
      end_at: endISO,
      status: "confirmed",
      notes: b.notes ?? null,
    })
    .select("id")
    .single();

  if (apptError || !appointment) {
    if (apptError?.code === "23P01") {
      return { ok: false, error: "Ese horario acaba de ocuparse." };
    }
    return { ok: false, error: "No se pudo crear la cita." };
  }

  after(() => notifyBookingConfirmed(appointment.id));
  revalidatePath("/dashboard/calendario");
  return { ok: true, date };
}
