"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import { getMyBusiness, isSlugAvailable } from "@/lib/businesses/queries";
import { slugSchema, validateSlug } from "@/lib/businesses/slug";
import { TIMEZONE_VALUES, TRIAL_DAYS } from "@/lib/businesses/constants";

export type BusinessFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

const nameField = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(80, "Máximo 80 caracteres");

const timezoneField = z
  .string()
  .refine((tz) => TIMEZONE_VALUES.has(tz), "Zona horaria inválida");

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createSchema = z.object({
  name: nameField,
  slug: slugSchema,
  timezone: timezoneField,
});

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const;

const updateSchema = z.object({
  name: nameField,
  slug: slugSchema,
  timezone: timezoneField,
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  brand_color: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Color hex, ej. #1e90ff").optional(),
  ),
  logo_url: z.preprocess(
    emptyToUndefined,
    z.string().trim().url("URL inválida").optional(),
  ),
  min_booking_notice_hours: z.coerce
    .number()
    .int()
    .min(0, "Entre 0 y 720")
    .max(720, "Entre 0 y 720"),
  max_booking_days: z.coerce
    .number()
    .int()
    .min(1, "Entre 1 y 365")
    .max(365, "Entre 1 y 365"),
  slot_interval_minutes: z.coerce
    .number()
    .int()
    .refine(
      (v): v is (typeof SLOT_INTERVALS)[number] =>
        (SLOT_INTERVALS as readonly number[]).includes(v),
      "Intervalo no permitido",
    ),
  cancellation_notice_hours: z.coerce
    .number()
    .int()
    .min(0, "Entre 0 y 720")
    .max(720, "Entre 0 y 720"),
});

/** Alta de negocio: crea `businesses` + enlaza `profiles.business_id`. */
export async function createBusiness(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const profile = await getProfile();
  if (!profile || profile.role !== "business_admin") {
    return { error: "No autorizado." };
  }
  if (profile.business_id) {
    redirect("/dashboard");
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { name, slug, timezone } = parsed.data;

  if (!(await isSlugAvailable(slug))) {
    return { fieldErrors: { slug: ["Ese enlace ya está en uso."] } };
  }

  const admin = createAdminClient();

  const { data: freePlan } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("name", "Free")
    .maybeSingle();

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: business, error: insertError } = await admin
    .from("businesses")
    .insert({
      name,
      slug,
      timezone,
      status: "trial",
      trial_ends_at: trialEndsAt,
      plan_id: freePlan?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !business) {
    if (insertError?.code === "23505") {
      return { fieldErrors: { slug: ["Ese enlace ya está en uso."] } };
    }
    return { error: "No se pudo crear el negocio. Intenta de nuevo." };
  }

  const { error: linkError } = await admin
    .from("profiles")
    .update({ business_id: business.id })
    .eq("id", profile.id);

  if (linkError) {
    // compensación: no dejar un negocio huérfano
    await admin.from("businesses").delete().eq("id", business.id);
    return { error: "No se pudo completar el alta. Intenta de nuevo." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Edición de la configuración del negocio (RLS: sólo su admin). */
export async function updateBusinessSettings(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const business = await getMyBusiness();
  if (!business) {
    return { error: "No autorizado." };
  }

  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    brand_color: formData.get("brand_color"),
    logo_url: formData.get("logo_url"),
    min_booking_notice_hours: formData.get("min_booking_notice_hours"),
    max_booking_days: formData.get("max_booking_days"),
    slot_interval_minutes: formData.get("slot_interval_minutes"),
    cancellation_notice_hours: formData.get("cancellation_notice_hours"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const d = parsed.data;

  if (d.slug !== business.slug) {
    const syntax = validateSlug(d.slug);
    if (!syntax.ok) return { fieldErrors: { slug: [syntax.reason] } };
    if (!(await isSlugAvailable(d.slug, business.id))) {
      return { fieldErrors: { slug: ["Ese enlace ya está en uso."] } };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: d.name,
      slug: d.slug,
      timezone: d.timezone,
      phone: d.phone ?? null,
      address: d.address ?? null,
      brand_color: d.brand_color ?? null,
      logo_url: d.logo_url ?? null,
      min_booking_notice_hours: d.min_booking_notice_hours,
      max_booking_days: d.max_booking_days,
      slot_interval_minutes: d.slot_interval_minutes,
      cancellation_notice_hours: d.cancellation_notice_hours,
    })
    .eq("id", business.id);

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { slug: ["Ese enlace ya está en uso."] } };
    }
    return { error: "No se pudieron guardar los cambios." };
  }

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard");
  return { message: "Cambios guardados." };
}

/** Chequeo en vivo de disponibilidad de slug (llamado desde el formulario). */
export async function checkSlug(
  slug: string,
  exceptSelf = false,
): Promise<{ available: boolean; reason?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "business_admin") {
    return { available: false, reason: "No autorizado." };
  }

  const normalized = slug.trim().toLowerCase();
  const syntax = validateSlug(normalized);
  if (!syntax.ok) return { available: false, reason: syntax.reason };

  const exceptId =
    exceptSelf && profile.business_id ? profile.business_id : undefined;
  const available = await isSlugAvailable(normalized, exceptId);
  return available
    ? { available: true }
    : { available: false, reason: "Ese enlace ya está en uso." };
}
