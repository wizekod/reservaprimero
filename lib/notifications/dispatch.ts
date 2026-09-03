import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import type {
  AppointmentStatus,
  Enums,
} from "@/lib/supabase/database.types";
import { sendEmail, type SendResult } from "@/lib/notifications/email";
import { sendWhatsApp, toWhatsAppAddress } from "@/lib/notifications/whatsapp";

type NotificationType = Enums<"notification_type">; // confirmation | reminder | cancellation
type Recipient = "customer" | "business";

type Ctx = {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  cancelToken: string;
  serviceName: string;
  staffName: string;
  businessName: string;
  timeZone: string;
  whatsappEnabled: boolean;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  ownerEmail: string | null;
};

type Nested<T> = T | T[] | null;
const pick = <T,>(v: Nested<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function loadCtx(appointmentId: string): Promise<Ctx | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select(
      `id, status, start_at, cancel_token, business_id,
       services ( name ),
       staff_members ( display_name ),
       customers ( name, email, phone ),
       businesses ( name, timezone, plan_id )`,
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) return null;

  const service = pick(data.services);
  const staff = pick(data.staff_members);
  const customer = pick(data.customers);
  const business = pick(data.businesses);
  if (!service || !staff || !customer || !business) return null;

  let whatsappEnabled = false;
  if (business.plan_id) {
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("features")
      .eq("id", business.plan_id)
      .maybeSingle();
    const features = (plan?.features ?? {}) as Record<string, unknown>;
    whatsappEnabled = features.whatsapp === true;
  }

  let ownerEmail: string | null = null;
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", data.business_id)
    .eq("role", "business_admin")
    .limit(1)
    .maybeSingle();
  if (owner) {
    const { data: u } = await admin.auth.admin.getUserById(owner.id);
    ownerEmail = u.user?.email ?? null;
  }

  return {
    id: data.id,
    status: data.status,
    startAt: data.start_at,
    cancelToken: data.cancel_token,
    serviceName: service.name,
    staffName: staff.display_name,
    businessName: business.name,
    timeZone: business.timezone,
    whatsappEnabled,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    ownerEmail,
  };
}

function whenText(ctx: Ctx): string {
  return new Date(ctx.startAt).toLocaleString("es", {
    timeZone: ctx.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const manageUrl = (ctx: Ctx) =>
  `${clientEnv.NEXT_PUBLIC_APP_URL}/reservas/${ctx.cancelToken}`;

async function alreadySent(
  appointmentId: string,
  channel: "email" | "whatsapp",
  type: NotificationType,
  recipient: Recipient,
  offset: number | null,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notifications_log")
    .select("id, reminder_offset_minutes")
    .eq("appointment_id", appointmentId)
    .eq("channel", channel)
    .eq("type", type)
    .eq("recipient", recipient)
    .eq("status", "sent");
  return (data ?? []).some(
    (r) => (r.reminder_offset_minutes ?? -1) === (offset ?? -1),
  );
}

async function logSend(
  appointmentId: string,
  channel: "email" | "whatsapp",
  type: NotificationType,
  recipient: Recipient,
  offset: number | null,
  result: SendResult,
) {
  if (result.status === "skipped") return; // modo protegido: no ensuciar el log
  const admin = createAdminClient();
  await admin.from("notifications_log").insert({
    appointment_id: appointmentId,
    channel,
    type,
    recipient,
    reminder_offset_minutes: offset,
    status: result.status === "sent" ? "sent" : "failed",
    error: result.status === "failed" ? result.error : null,
    sent_at: result.status === "sent" ? new Date().toISOString() : null,
  });
}

async function deliver(
  ctx: Ctx,
  type: NotificationType,
  opts: {
    offset?: number | null;
    subject: string;
    customerText: string;
    ownerText?: string;
    skipDedupe?: boolean;
  },
) {
  const offset = opts.offset ?? null;

  // Cliente — email
  if (ctx.customerEmail) {
    if (opts.skipDedupe || !(await alreadySent(ctx.id, "email", type, "customer", offset))) {
      const r = await sendEmail({
        to: ctx.customerEmail,
        subject: opts.subject,
        text: opts.customerText,
      });
      await logSend(ctx.id, "email", type, "customer", offset, r);
    }
  }

  // Cliente — WhatsApp (solo si el plan lo incluye)
  const wa = toWhatsAppAddress(ctx.customerPhone);
  if (wa && ctx.whatsappEnabled) {
    if (opts.skipDedupe || !(await alreadySent(ctx.id, "whatsapp", type, "customer", offset))) {
      const r = await sendWhatsApp({ to: wa, body: opts.customerText });
      await logSend(ctx.id, "whatsapp", type, "customer", offset, r);
    }
  }

  // Aviso interno al negocio — email
  if (opts.ownerText && ctx.ownerEmail) {
    if (opts.skipDedupe || !(await alreadySent(ctx.id, "email", type, "business", offset))) {
      const r = await sendEmail({
        to: ctx.ownerEmail,
        subject: `[${ctx.businessName}] ${opts.subject}`,
        text: opts.ownerText,
      });
      await logSend(ctx.id, "email", type, "business", offset, r);
    }
  }
}

async function clearSentLogs(appointmentId: string, type: NotificationType) {
  const admin = createAdminClient();
  await admin
    .from("notifications_log")
    .delete()
    .eq("appointment_id", appointmentId)
    .eq("type", type)
    .eq("status", "sent");
}

// ── API pública ─────────────────────────────────────────────────────────

export async function notifyBookingCreated(appointmentId: string): Promise<void> {
  const ctx = await loadCtx(appointmentId);
  if (!ctx) return;
  const confirmed = ctx.status === "confirmed";
  await deliver(ctx, "confirmation", {
    subject: `Reserva ${confirmed ? "confirmada" : "recibida"} en ${ctx.businessName}`,
    customerText:
      `Hola ${ctx.customerName}, tu reserva de ${ctx.serviceName} el ${whenText(ctx)} ` +
      `con ${ctx.staffName} ${confirmed ? "está confirmada" : "quedó pendiente de confirmación"}.\n\n` +
      `Para cancelar o reagendar: ${manageUrl(ctx)}`,
    ownerText:
      `Nueva reserva: ${ctx.serviceName} · ${whenText(ctx)} · ${ctx.staffName}\n` +
      `Cliente: ${ctx.customerName}${ctx.customerPhone ? ` (${ctx.customerPhone})` : ""}`,
  });
}

export async function notifyBookingConfirmed(appointmentId: string): Promise<void> {
  const ctx = await loadCtx(appointmentId);
  if (!ctx || ctx.status !== "confirmed") return;
  await clearSentLogs(appointmentId, "confirmation");
  await deliver(ctx, "confirmation", {
    skipDedupe: true,
    subject: `Reserva confirmada en ${ctx.businessName}`,
    customerText:
      `Hola ${ctx.customerName}, tu reserva de ${ctx.serviceName} el ${whenText(ctx)} ` +
      `con ${ctx.staffName} ha sido confirmada.\n\nGestionar: ${manageUrl(ctx)}`,
  });
}

export async function notifyBookingCancelled(appointmentId: string): Promise<void> {
  const ctx = await loadCtx(appointmentId);
  if (!ctx) return;
  await deliver(ctx, "cancellation", {
    subject: `Reserva cancelada en ${ctx.businessName}`,
    customerText:
      `Hola ${ctx.customerName}, tu reserva de ${ctx.serviceName} del ${whenText(ctx)} ` +
      `ha sido cancelada.`,
    ownerText: `Reserva cancelada: ${ctx.serviceName} · ${whenText(ctx)} · ${ctx.customerName}`,
  });
}

export async function notifyBookingRescheduled(appointmentId: string): Promise<void> {
  const ctx = await loadCtx(appointmentId);
  if (!ctx) return;
  await clearSentLogs(appointmentId, "confirmation");
  await deliver(ctx, "confirmation", {
    skipDedupe: true,
    subject: `Reserva reagendada en ${ctx.businessName}`,
    customerText:
      `Hola ${ctx.customerName}, tu reserva de ${ctx.serviceName} quedó para el ${whenText(ctx)} ` +
      `con ${ctx.staffName}.\n\nGestionar: ${manageUrl(ctx)}`,
    ownerText: `Reserva reagendada: ${ctx.serviceName} · ${whenText(ctx)} · ${ctx.customerName}`,
  });
}

export async function notifyReminder(
  appointmentId: string,
  offsetMinutes: number,
): Promise<void> {
  const ctx = await loadCtx(appointmentId);
  if (!ctx) return;
  if (ctx.status !== "confirmed" && ctx.status !== "pending") return;
  await deliver(ctx, "reminder", {
    offset: offsetMinutes,
    subject: `Recordatorio: tu cita en ${ctx.businessName}`,
    customerText:
      `Hola ${ctx.customerName}, te recordamos tu cita de ${ctx.serviceName} el ${whenText(ctx)} ` +
      `con ${ctx.staffName}.\n\nCancelar o reagendar: ${manageUrl(ctx)}`,
  });
}
