"use client";

import { useActionState } from "react";

import {
  createBusiness,
  type BusinessFormState,
} from "@/lib/businesses/actions";
import { SlugField } from "@/components/businesses/slug-field";
import { TimezoneSelect } from "@/components/businesses/timezone-select";
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

export function OnboardingForm({ hostBase }: { hostBase: string }) {
  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(createBusiness, {});

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Crea tu negocio</CardTitle>
          <CardDescription>
            Estos datos aparecen en tu página pública de reservas. Podrás
            cambiarlos después en Configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input id="name" name="name" required minLength={2} maxLength={80} />
            {state.fieldErrors?.name?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            ) : null}
          </div>

          <SlugField hostBase={hostBase} serverError={state.fieldErrors?.slug} />

          <div className="grid gap-2">
            <Label htmlFor="timezone">Zona horaria</Label>
            <TimezoneSelect />
            {state.fieldErrors?.timezone?.length ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.timezone[0]}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear negocio"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
