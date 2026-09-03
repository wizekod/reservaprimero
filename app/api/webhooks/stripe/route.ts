import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["active", "trialing"];
const DOWNGRADE_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

/**
 * Sincroniza el estado de la suscripción en `businesses` (CLAUDE.md §9).
 * Modo protegido: sin `STRIPE_WEBHOOK_SECRET` responde 200 sin hacer nada.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return new Response("stripe no configurado", { status: 200 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? "", secret);
  } catch (err) {
    return new Response(
      `firma inválida: ${err instanceof Error ? err.message : "error"}`,
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const priceId = sub.items.data[0]?.price.id ?? null;

    const patch: TablesUpdate<"businesses"> = {
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
    };

    if (ACTIVE_STATUSES.includes(sub.status) && priceId) {
      const { data: plan } = await admin
        .from("subscription_plans")
        .select("id")
        .eq("stripe_price_id", priceId)
        .maybeSingle();
      if (plan) patch.plan_id = plan.id;
    } else if (DOWNGRADE_STATUSES.includes(sub.status)) {
      const { data: free } = await admin
        .from("subscription_plans")
        .select("id")
        .eq("name", "Free")
        .maybeSingle();
      if (free) patch.plan_id = free.id;
    }

    await admin
      .from("businesses")
      .update(patch)
      .eq("stripe_customer_id", customerId);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub);
      }
      break;
    }
    default:
      break;
  }

  return new Response("ok");
}
