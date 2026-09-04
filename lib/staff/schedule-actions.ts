"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/businesses/queries";
import {
  exceptionSchema,
  findOverlap,
  rangeSchema,
  type Range,
} from "@/lib/staff/schedule";

type Result = { ok: boolean; error?: string };

async function assertOwnsStaff(staffId: string): Promise<boolean> {
  const business = await getMyBusiness();
  if (!business) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  return Boolean(data);
}

export async function setWeeklySchedule(
  staffId: string,
  ranges: Range[],
): Promise<Result> {
  if (!(await assertOwnsStaff(staffId))) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = z.array(rangeSchema).safeParse(ranges);
  if (!parsed.success) {
    return { ok: false, error: "Hay franjas con horas inválidas." };
  }
  const overlap = findOverlap(parsed.data);
  if (overlap) return { ok: false, error: overlap };

  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("availability_rules")
    .delete()
    .eq("staff_member_id", staffId);
  if (delError) return { ok: false, error: "No se pudo guardar el horario." };

  if (parsed.data.length > 0) {
    const { error } = await supabase.from("availability_rules").insert(
      parsed.data.map((r) => ({
        staff_member_id: staffId,
        day_of_week: r.day_of_week,
        start_time: r.start,
        end_time: r.end,
      })),
    );
    if (error) return { ok: false, error: "No se pudo guardar el horario." };
  }

  revalidatePath(`/dashboard/staff/${staffId}/horario`);
  return { ok: true };
}

export async function addException(
  staffId: string,
  input: unknown,
): Promise<Result> {
  if (!(await assertOwnsStaff(staffId))) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        z.flattenError(parsed.error).formErrors[0] ??
        "Datos de la excepción inválidos.",
    };
  }
  const e = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("availability_exceptions").insert({
    staff_member_id: staffId,
    date: e.date,
    is_closed: e.is_closed,
    start_time: e.is_closed || !e.start ? null : e.start,
    end_time: e.is_closed || !e.end ? null : e.end,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya hay una excepción para esa fecha." };
    }
    return { ok: false, error: "No se pudo guardar la excepción." };
  }

  revalidatePath(`/dashboard/staff/${staffId}/horario`);
  return { ok: true };
}

export async function deleteException(
  staffId: string,
  exceptionId: string,
): Promise<Result> {
  if (!(await assertOwnsStaff(staffId))) {
    return { ok: false, error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("staff_member_id", staffId);
  if (error) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath(`/dashboard/staff/${staffId}/horario`);
  return { ok: true };
}

/**
 * Bloquea una fecha (o una franja) para un profesional o para todo el equipo.
 * `staffId === "all"` aplica a todos los activos del negocio.
 */
export async function blockTime(
  staffId: string,
  input: unknown,
): Promise<Result & { skipped?: number }> {
  const business = await getMyBusiness();
  if (!business) return { ok: false, error: "No autorizado." };

  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        z.flattenError(parsed.error).formErrors[0] ??
        "Revisa la fecha y el horario.",
    };
  }
  const e = parsed.data;

  const supabase = await createClient();
  let targets: string[];

  if (staffId === "all") {
    const { data } = await supabase
      .from("staff_members")
      .select("id")
      .eq("business_id", business.id)
      .eq("active", true);
    targets = (data ?? []).map((s) => s.id);
  } else {
    if (!(await assertOwnsStaff(staffId))) {
      return { ok: false, error: "No autorizado." };
    }
    targets = [staffId];
  }

  if (targets.length === 0) {
    return { ok: false, error: "No hay profesionales activos." };
  }

  let inserted = 0;
  let skipped = 0;
  for (const id of targets) {
    const { error } = await supabase.from("availability_exceptions").insert({
      staff_member_id: id,
      date: e.date,
      is_closed: e.is_closed,
      start_time: e.is_closed || !e.start ? null : e.start,
      end_time: e.is_closed || !e.end ? null : e.end,
    });
    if (error) {
      if (error.code === "23505") skipped += 1;
      else return { ok: false, error: "No se pudo guardar el bloqueo." };
    } else {
      inserted += 1;
    }
  }

  revalidatePath("/dashboard/bloquear-horario");
  if (inserted === 0) {
    return { ok: false, error: "Ya existe un bloqueo para esa fecha." };
  }
  return { ok: true, skipped };
}
