import "server-only";

import Stripe from "stripe";

let cached: Stripe | null | undefined;

/** Cliente Stripe, o `null` si falta `STRIPE_SECRET_KEY` (modo protegido). */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
