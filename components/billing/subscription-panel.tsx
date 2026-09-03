"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal, startCheckout } from "@/lib/stripe/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SUB_STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Impaga",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Pausada",
};

export function SubscriptionPanel({
  planName,
  monthlyLimit,
  subscriptionStatus,
  trialEndsAt,
  hasCustomer,
  paymentsConfigured,
}: {
  planName: string;
  monthlyLimit: number | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  hasCustomer: boolean;
  paymentsConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function checkout() {
    startTransition(async () => {
      const res = await startCheckout();
      if (res.url) window.location.href = res.url;
      else toast.error(res.error ?? "Error");
    });
  }
  function portal() {
    startTransition(async () => {
      const res = await openBillingPortal();
      if (res.url) window.location.href = res.url;
      else toast.error(res.error ?? "Error");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan {planName}</CardTitle>
        <CardDescription>
          {monthlyLimit == null
            ? "Reservas ilimitadas."
            : `Hasta ${monthlyLimit} reservas al mes.`}
          {subscriptionStatus
            ? ` · Suscripción: ${SUB_STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {trialEndsAt ? (
          <p>
            Prueba hasta el{" "}
            {new Date(trialEndsAt).toLocaleDateString("es", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
        ) : null}
        {!paymentsConfigured ? (
          <p>Los pagos aún no están habilitados en la plataforma.</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={checkout}
          disabled={pending || !paymentsConfigured}
        >
          Cambiar a Premium
        </Button>
        {hasCustomer ? (
          <Button
            type="button"
            variant="outline"
            onClick={portal}
            disabled={pending}
          >
            Gestionar suscripción
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
