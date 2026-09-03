"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { updatePlan } from "@/lib/superadmin/actions";
import type { FormState } from "@/lib/forms";
import type { PlanRow } from "@/lib/superadmin/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlanForm({ plan }: { plan: PlanRow }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePlan,
    {},
  );
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.message && state.message !== last.current) {
      last.current = state.message;
      toast.success(state.message);
    }
  }, [state.message]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{plan.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <input type="hidden" name="id" value={plan.id} />
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor={`name-${plan.id}`}>Nombre</Label>
            <Input
              id={`name-${plan.id}`}
              name="name"
              defaultValue={plan.name}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`price-${plan.id}`}>Precio mensual</Label>
              <Input
                id={`price-${plan.id}`}
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={plan.price}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`limit-${plan.id}`}>
                Límite de reservas/mes (vacío = ilimitado)
              </Label>
              <Input
                id={`limit-${plan.id}`}
                name="monthly_booking_limit"
                type="number"
                min={0}
                defaultValue={plan.monthly_booking_limit ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`price-id-${plan.id}`}>Stripe price ID</Label>
            <Input
              id={`price-id-${plan.id}`}
              name="stripe_price_id"
              defaultValue={plan.stripe_price_id ?? ""}
              placeholder="price_..."
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
