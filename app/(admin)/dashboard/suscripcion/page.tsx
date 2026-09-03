import type { Metadata } from "next";
import Link from "next/link";

import { getMyBusiness } from "@/lib/businesses/queries";
import { createClient } from "@/lib/supabase/server";
import { stripeEnabled } from "@/lib/stripe/client";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";

export const metadata: Metadata = { title: "Suscripción · ReservaPrimero" };

export default async function SuscripcionPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const supabase = await createClient();
  const [{ data: currentPlan }, { data: premium }] = await Promise.all([
    business.plan_id
      ? supabase
          .from("subscription_plans")
          .select("name, monthly_booking_limit")
          .eq("id", business.plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("subscription_plans")
      .select("stripe_price_id")
      .eq("name", "Premium")
      .maybeSingle(),
  ]);

  const paymentsConfigured = stripeEnabled() && Boolean(premium?.stripe_price_id);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Volver al panel
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Suscripción</h1>
      <SubscriptionPanel
        planName={currentPlan?.name ?? "—"}
        monthlyLimit={currentPlan?.monthly_booking_limit ?? null}
        subscriptionStatus={business.subscription_status}
        trialEndsAt={business.trial_ends_at}
        hasCustomer={Boolean(business.stripe_customer_id)}
        paymentsConfigured={paymentsConfigured}
      />
    </div>
  );
}
