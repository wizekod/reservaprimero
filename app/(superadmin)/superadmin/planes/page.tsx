import type { Metadata } from "next";
import Link from "next/link";

import { listPlans } from "@/lib/superadmin/queries";
import { PlanForm } from "@/components/superadmin/plan-form";

export const metadata: Metadata = { title: "Planes · ReservaPrimero" };

export default async function PlanesPage() {
  const plans = await listPlans();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/superadmin"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Plataforma
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
      <p className="text-sm text-muted-foreground">
        El <code>stripe_price_id</code> se usa en el checkout de suscripción. El
        límite de reservas del plan Free se aplica al crear citas.
      </p>
      <div className="space-y-4">
        {plans.map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
      </div>
    </div>
  );
}
