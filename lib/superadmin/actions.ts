"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import type { BusinessStatus } from "@/lib/supabase/database.types";
import { emptyToUndefined, type FormState } from "@/lib/forms";

type Result = { ok: boolean; error?: string };

async function assertSuperadmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "superadmin";
}

const STATUSES: BusinessStatus[] = ["active", "suspended", "trial"];

/** Activar / suspender / poner en trial un negocio (columna protegida → service_role). */
export async function setBusinessStatus(
  id: string,
  status: BusinessStatus,
): Promise<Result> {
  if (!(await assertSuperadmin())) return { ok: false, error: "No autorizado." };
  if (!STATUSES.includes(status)) return { ok: false, error: "Estado inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("businesses")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/superadmin");
  return { ok: true };
}

const planSchema = z.object({
  name: z.string().trim().min(2).max(40),
  price: z.coerce.number().min(0).max(9_999_999),
  monthly_booking_limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(1_000_000).optional(),
  ),
  stripe_price_id: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120).optional(),
  ),
});

export async function updatePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await assertSuperadmin())) return { error: "No autorizado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Plan no encontrado." };

  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    monthly_booking_limit: formData.get("monthly_booking_limit"),
    stripe_price_id: formData.get("stripe_price_id"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("subscription_plans")
    .update({
      name: d.name,
      price: d.price,
      monthly_booking_limit: d.monthly_booking_limit ?? null,
      stripe_price_id: d.stripe_price_id ?? null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un plan con ese nombre o price_id." };
    }
    return { error: "No se pudo guardar el plan." };
  }

  revalidatePath("/superadmin/planes");
  return { message: "Plan guardado." };
}
