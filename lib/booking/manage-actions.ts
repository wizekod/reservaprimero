"use server";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { getSlots } from "@/lib/availability/queries";
import { todayInTz, addDays } from "@/lib/availability/tz";
import { getAppointmentByToken } from "@/lib/booking/manage";

type Result = { ok: boolean; error?: string };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function cancelByToken(token: string): Promise<Result> {
  const appt = await getAppointmentByToken(token);
  if (!appt) return { ok: false, error: "Reserva no encontrada." };
  if (!appt.canModify) {
    return { ok: false, error: "Ya no se puede cancelar esta reserva." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appt.id);
  if (error) return { ok: false, error: "No se pudo cancelar." };

  // TODO(notificaciones): avisar al negocio de la cancelación.
  return { ok: true };
}

export async function fetchSlotsForReschedule(token: string, date: string) {
  if (!dateRe.test(date)) return { ok: false as const, reason: "bad_date" };
  const appt = await getAppointmentByToken(token);
  if (!appt || !appt.canModify) {
    return { ok: false as const, reason: "not_modifiable" };
  }

  const today = todayInTz(appt.timeZone);
  if (date < today || date > addDays(today, appt.maxBookingDays)) {
    return {
      ok: true as const,
      slots: [],
      timeZone: appt.timeZone,
      slotIntervalMinutes: 0,
    };
  }

  return getSlots({
    slug: appt.businessSlug,
    serviceId: appt.serviceId,
    staffId: appt.staffMemberId,
    dateFrom: date,
    dateTo: date,
    excludeAppointmentId: appt.id,
  });
}

export async function rescheduleByToken(
  token: string,
  newStartISO: string,
): Promise<Result & { manageUrl?: string; newToken?: string; startAt?: string }> {
  const appt = await getAppointmentByToken(token);
  if (!appt) return { ok: false, error: "Reserva no encontrada." };
  if (!appt.canModify) {
    return { ok: false, error: "Ya no se puede reagendar esta reserva." };
  }

  const start = new Date(newStartISO);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Horario inválido." };
  }
  const startISO = start.toISOString();
  const date = todayInTz(appt.timeZone, start);

  const avail = await getSlots({
    slug: appt.businessSlug,
    serviceId: appt.serviceId,
    staffId: appt.staffMemberId,
    dateFrom: date,
    dateTo: date,
    excludeAppointmentId: appt.id,
  });
  if (
    !avail.ok ||
    !avail.slots.some(
      (s) => s.staffMemberId === appt.staffMemberId && s.start === startISO,
    )
  ) {
    return { ok: false, error: "Ese horario ya no está disponible." };
  }

  const endISO = new Date(
    start.getTime() + appt.serviceDurationMinutes * 60_000,
  ).toISOString();
  const newToken = randomUUID();

  const admin = createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ start_at: startISO, end_at: endISO, cancel_token: newToken })
    .eq("id", appt.id);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Ese horario acaba de ocuparse. Elige otro." };
    }
    return { ok: false, error: "No se pudo reagendar." };
  }

  // TODO(notificaciones): avisar del cambio de horario.
  return {
    ok: true,
    newToken,
    startAt: startISO,
    manageUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}/reservas/${newToken}`,
  };
}
