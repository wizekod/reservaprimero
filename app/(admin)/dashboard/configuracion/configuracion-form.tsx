"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  updateBusinessSettings,
  type BusinessFormState,
} from "@/lib/businesses/actions";
import type { BusinessRow } from "@/lib/supabase/database.types";
import { SlugField } from "@/components/businesses/slug-field";
import { TimezoneSelect } from "@/components/businesses/timezone-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ConfiguracionForm({
  business,
  hostBase,
}: {
  business: BusinessRow;
  hostBase: string;
}) {
  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(updateBusinessSettings, {});
  const lastMessage = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.message && state.message !== lastMessage.current) {
      lastMessage.current = state.message;
      toast.success(state.message);
    }
  }, [state.message]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Volver al panel
        </Link>
      </div>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Datos del negocio</CardTitle>
            <CardDescription>
              Aparecen en tu página pública{" "}
              <span className="font-medium">
                {hostBase}/{business.slug}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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
                defaultValue={business.name}
                required
                minLength={2}
                maxLength={80}
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <SlugField
              hostBase={hostBase}
              defaultValue={business.slug}
              exceptSelf
              serverError={state.fieldErrors?.slug}
            />

            <div className="grid gap-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <TimezoneSelect defaultValue={business.timezone} />
              <FieldError messages={state.fieldErrors?.timezone} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={business.phone ?? ""}
                  maxLength={30}
                />
                <FieldError messages={state.fieldErrors?.phone} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand_color">Color de marca</Label>
                <Input
                  id="brand_color"
                  name="brand_color"
                  defaultValue={business.brand_color ?? ""}
                  placeholder="#1e90ff"
                />
                <FieldError messages={state.fieldErrors?.brand_color} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Dirección</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={business.address ?? ""}
                maxLength={200}
                rows={2}
              />
              <FieldError messages={state.fieldErrors?.address} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logo_url">URL del logo</Label>
              <Input
                id="logo_url"
                name="logo_url"
                type="url"
                defaultValue={business.logo_url ?? ""}
                placeholder="https://…"
              />
              <FieldError messages={state.fieldErrors?.logo_url} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
