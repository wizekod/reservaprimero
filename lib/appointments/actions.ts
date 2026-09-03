"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { getMyBusiness } from "@/lib/businesses/queries";
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

  revalidatePath("/dashboard/citas");
  revalidatePath("/staff");
  return { ok: true };
}
