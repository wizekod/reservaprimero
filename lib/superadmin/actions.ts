"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe/client";
import { MEDIA_BUCKET, type MediaKind } from "@/lib/storage/media";
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

const MEDIA_KINDS: MediaKind[] = ["staff", "services", "logos"];

/**
 * Borra un negocio y todo lo suyo. Irreversible, así que sólo procede si el
 * negocio ya está suspendido y `confirmSlug` coincide con su slug (el
 * diálogo pide escribirlo).
 *
 * Orden: primero lo externo (Stripe, Storage), que es lo que se puede
 * reintentar si falla, y al final la fila. Las FK en cascada se llevan
 * servicios, staff, horarios, clientes, historia clínica, citas y logs.
 * Después se borran las cuentas del dueño y del staff, que sin negocio
 * quedarían huérfanas.
 */
export async function deleteBusiness(
  id: string,
  confirmSlug: string,
): Promise<Result> {
  if (!(await assertSuperadmin())) return { ok: false, error: "No autorizado." };

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("slug, status, stripe_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (!biz) return { ok: false, error: "Negocio no encontrado." };
  if (biz.status !== "suspended") {
    return { ok: false, error: "Suspende el negocio antes de borrarlo." };
  }
  if (confirmSlug.trim() !== biz.slug) {
    return { ok: false, error: "El slug no coincide." };
  }

  // Sin esto Stripe seguiría cobrando a un negocio que ya no existe.
  const stripe = getStripe();
  if (biz.stripe_subscription_id && stripe) {
    try {
      await stripe.subscriptions.cancel(biz.stripe_subscription_id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "resource_missing") {
        return { ok: false, error: "No se pudo cancelar la suscripción en Stripe." };
      }
    }
  }

  // Las imágenes son públicas: avatares del staff incluidos.
  const storage = admin.storage.from(MEDIA_BUCKET);
  for (const kind of MEDIA_KINDS) {
    const { data: files, error } = await storage.list(`${id}/${kind}`, {
      limit: 1000,
    });
    if (error) return { ok: false, error: "No se pudieron borrar las imágenes." };
    if (files.length > 0) {
      const { error: rmError } = await storage.remove(
        files.map((f) => `${id}/${kind}/${f.name}`),
      );
      if (rmError) return { ok: false, error: "No se pudieron borrar las imágenes." };
    }
  }

  // Dueño y staff con cuenta: todos llevan `profiles.business_id`. Se leen
  // antes de borrar porque después esa columna queda en null. No se usa
  // `staff_members.profile_id`: si apuntara por error a otro negocio, se
  // borraría una cuenta ajena.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", id)
    .neq("role", "superadmin");
  const userIds = (profiles ?? []).map((p) => p.id);

  const { error } = await admin.from("businesses").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar el negocio." };

  const failed: string[] = [];
  for (const uid of userIds) {
    const { error: userError } = await admin.auth.admin.deleteUser(uid);
    if (userError) failed.push(uid);
  }

  revalidatePath("/superadmin");
  if (failed.length > 0) {
    return {
      ok: true,
      error: `Negocio borrado, pero ${failed.length} cuenta(s) de usuario no se pudieron borrar.`,
    };
  }
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
