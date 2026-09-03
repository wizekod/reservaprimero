import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessStatus } from "@/lib/supabase/database.types";

export type AdminBusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  planName: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  appointmentCount: number;
};

export async function listBusinessesForAdmin(): Promise<AdminBusinessRow[]> {
  const admin = createAdminClient();

  const [{ data: businesses }, { data: plans }] = await Promise.all([
    admin
      .from("businesses")
      .select(
        "id, name, slug, status, plan_id, subscription_status, trial_ends_at, created_at",
      )
      .order("created_at", { ascending: false }),
    admin.from("subscription_plans").select("id, name"),
  ]);

  const planName = new Map((plans ?? []).map((p) => [p.id, p.name]));

  const rows = businesses ?? [];
  const counts = await Promise.all(
    rows.map(async (b) => {
      const { count } = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", b.id);
      return count ?? 0;
    }),
  );

  return rows.map((b, i) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    status: b.status,
    planName: b.plan_id ? (planName.get(b.plan_id) ?? null) : null,
    subscriptionStatus: b.subscription_status,
    trialEndsAt: b.trial_ends_at,
    createdAt: b.created_at,
    appointmentCount: counts[i]!,
  }));
}

export async function getPlatformMetrics() {
  const admin = createAdminClient();
  const countWhere = async (status?: BusinessStatus) => {
    let q = admin
      .from("businesses")
      .select("id", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    const { count } = await q;
    return count ?? 0;
  };
  const { count: appointments } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true });

  const [total, active, trial, suspended] = await Promise.all([
    countWhere(),
    countWhere("active"),
    countWhere("trial"),
    countWhere("suspended"),
  ]);

  // MRR estimado: nº de negocios con suscripción activa × precio del plan Premium.
  const { data: premium } = await admin
    .from("subscription_plans")
    .select("price")
    .eq("name", "Premium")
    .maybeSingle();
  const { count: paying } = await admin
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .in("subscription_status", ["active", "trialing"]);
  const mrr = Math.round((paying ?? 0) * Number(premium?.price ?? 0));

  return {
    total,
    active,
    trial,
    suspended,
    appointments: appointments ?? 0,
    mrr,
  };
}

export async function listPlans() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscription_plans")
    .select("id, name, stripe_price_id, monthly_booking_limit, price, features")
    .order("price");
  return data ?? [];
}

export type PlanRow = Awaited<ReturnType<typeof listPlans>>[number];
