"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { FormState } from "@/lib/forms";
import type { CustomerRow } from "@/lib/supabase/database.types";
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

type CustomerAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function CustomerForm({
  action,
  customer,
  title,
  submitLabel,
}: {
  action: CustomerAction;
  customer?: CustomerRow;
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state.message]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

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
              defaultValue={customer?.name ?? ""}
              required
              minLength={2}
              maxLength={80}
            />
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={customer?.phone ?? ""}
              maxLength={30}
            />
            {customer?.phone_key ? (
              <p className="text-xs text-muted-foreground">
                Se reconoce como{" "}
                <span className="font-medium tabular-nums">
                  {customer.phone_key}
                </span>{" "}
                ·{" "}
                <a
                  href={`https://wa.me/${customer.phone_key.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  escribir por WhatsApp
                </a>
              </p>
            ) : null}
            <FieldError messages={state.fieldErrors?.phone} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={customer?.email ?? ""}
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Link
            href="/dashboard/clientes"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Clientes
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
