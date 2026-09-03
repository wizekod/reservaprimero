"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createStaff } from "@/lib/staff/actions";
import type { FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StaffForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStaff,
    {},
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href="/dashboard/staff"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Staff
      </Link>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Nuevo miembro del staff</CardTitle>
            <CardDescription>
              Si añades un correo, le enviaremos una invitación para acceder a su
              propio panel. Sin correo, queda como recurso reservable que
              gestionas tú.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="display_name">Nombre visible</Label>
              <Input
                id="display_name"
                name="display_name"
                required
                minLength={2}
                maxLength={60}
              />
              {state.fieldErrors?.display_name?.length ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.display_name[0]}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Correo (opcional)</Label>
              <Input id="email" name="email" type="email" autoComplete="off" />
              {state.fieldErrors?.email?.length ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.email[0]}
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Guardando…" : "Añadir al staff"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
