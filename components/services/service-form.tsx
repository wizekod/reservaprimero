"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { FormState } from "@/lib/forms";
import type { ServiceRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ServiceAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ServiceForm({
  action,
  service,
  title,
  submitLabel,
}: {
  action: ServiceAction;
  service?: ServiceRow;
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/dashboard/servicios"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Servicios
      </Link>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {service ? <input type="hidden" name="id" value={service.id} /> : null}

            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                defaultValue={service?.name ?? ""}
                required
                minLength={2}
                maxLength={80}
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={service?.description ?? ""}
                maxLength={500}
                rows={3}
              />
              <FieldError messages={state.fieldErrors?.description} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="duration_minutes">Duración (minutos)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={1440}
                  step={5}
                  defaultValue={service?.duration_minutes ?? 30}
                  required
                />
                <FieldError messages={state.fieldErrors?.duration_minutes} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  defaultValue={service?.price ?? 0}
                  required
                />
                <FieldError messages={state.fieldErrors?.price} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="buffer_minutes">Margen entre citas (min)</Label>
                <Input
                  id="buffer_minutes"
                  name="buffer_minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={240}
                  step={5}
                  defaultValue={service?.buffer_minutes ?? 0}
                />
                <FieldError messages={state.fieldErrors?.buffer_minutes} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="color">Color (opcional)</Label>
                <Input
                  id="color"
                  name="color"
                  defaultValue={service?.color ?? ""}
                  placeholder="#1e90ff"
                />
                <FieldError messages={state.fieldErrors?.color} />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : submitLabel}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
