"use client";

import { useActionState } from "react";

import { setInitialPassword } from "@/lib/auth/actions";
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

export function DefinirClaveForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setInitialPassword,
    {},
  );

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Define tu contraseña</CardTitle>
          <CardDescription>
            {email ? `Para la cuenta ${email}.` : null} Con ella entrarás a tu
            panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            {state.fieldErrors?.password?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm">Repite la contraseña</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            {state.fieldErrors?.confirm?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.confirm[0]}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar y entrar"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
