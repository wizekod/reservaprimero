"use server";

import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import { clientEnv } from "@/lib/env";

type UrlResult = { url?: string; error?: string };

/** Estados de Stripe en los que la suscripción sigue viva (cobrando o por cobrar). */
const LIVE_STATUSES = ["active", "trialing", "past_due", "incomplete"];
const hasLiveSubscription = (status: string | null) =>
  status !== null && LIVE_STATUSES.includes(status);

async function currentBusiness() {
  const profile = await getProfile();
  if (profile?.role !== "business_admin" || !profile.business_id) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("businesses")
    .select("id, name, stripe_customer_id, subscription_status")
    .eq("id", profile.business_id)
    .maybeSingle();
  return data ?? null;
}

/** Checkout de suscripción al plan Premium. */
export async function startCheckout(): Promise<UrlResult> {
  const stripe = getStripe();
  if (!stripe) return { error: "Los pagos aún no están configurados." };

  const business = await currentBusiness();
  if (!business) return { error: "No autorizado." };
  // Un segundo Checkout crearía otra suscripción y cobraría dos veces.
  if (hasLiveSubscription(business.subscription_status)) {
    return { error: "Ya tienes una suscripción. Gestiónala desde el portal." };
  }

  const admin = createAdminClient();
  const { data: premium } = await admin
    .from("subscription_plans")
    .select("stripe_price_id")
    .eq("name", "Premium")
    .maybeSingle();
  if (!premium?.stripe_price_id) {
    return { error: "El plan Premium no tiene un precio configurado en Stripe." };
  }

  let customerId = business.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: business.name,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
    await admin
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", business.id);
  }

  // Un error de Stripe (precio inexistente, claves de otro modo…) no debe
  // tumbar la página: se registra y el panel muestra un aviso.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: premium.stripe_price_id, quantity: 1 }],
      success_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard/suscripcion?ok=1`,
      cancel_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard/suscripcion`,
      metadata: { business_id: business.id },
      subscription_data: { metadata: { business_id: business.id } },
    });
    return { url: session.url ?? undefined };
  } catch (err) {
    console.error("[stripe] checkout", err);
    return { error: "No se pudo iniciar el pago. Inténtalo más tarde." };
  }
}

/** Portal de facturación de Stripe (cambiar método de pago, cancelar). */
export async function openBillingPortal(): Promise<UrlResult> {
  const stripe = getStripe();
  if (!stripe) return { error: "Los pagos aún no están configurados." };

  const business = await currentBusiness();
  if (!business) return { error: "No autorizado." };
  if (!business.stripe_customer_id) {
    return { error: "Aún no tienes una suscripción activa." };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard/suscripcion`,
    });
    return { url: session.url };
  } catch (err) {
    // Típico: el portal no se ha guardado en el panel de Stripe.
    console.error("[stripe] portal", err);
    return { error: "No se pudo abrir el portal de pagos. Inténtalo más tarde." };
  }
}
