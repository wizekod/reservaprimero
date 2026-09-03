import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Negocio para la página pública (solo columnas concedidas a anon). `null` si no existe o está suspendido. */
export async function getPublicBusiness(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, timezone, logo_url, brand_color, phone, address, status, auto_confirm_bookings, min_booking_notice_hours, max_booking_days, cancellation_notice_hours",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data || data.status === "suspended") return null;
  return data;
}

export type PublicBusiness = NonNullable<
  Awaited<ReturnType<typeof getPublicBusiness>>
>;

export async function getPublicServices(businessId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price, color")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name");
  return data ?? [];
}

export type PublicService = Awaited<
  ReturnType<typeof getPublicServices>
>[number];
