"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  changePassword,
  requestEmailChange,
  updateAccountName,
} from "@/lib/account/actions";
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

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

function FormErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}

/** Toast con el mensaje de éxito de cada envío (cada respuesta es un objeto nuevo). */
function useSuccessToast(state: FormState) {
  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);
}

function NameCard({ fullName }: { fullName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateAccountName,
    {},
  );
  useSuccessToast(state);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>Tu nombre dentro del panel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormErrorBanner error={state.error} />
          <div className="grid gap-2">
            <Label htmlFor="account-fullName">Nombre</Label>
            <Input
              id="account-fullName"
              name="fullName"
              defaultValue={fullName}
              autoComplete="name"
              required
            />
            <FieldError messages={state.fieldErrors?.fullName} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar nombre"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function EmailCard({
  email,
  pendingEmail,
}: {
  email: string;
  pendingEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestEmailChange,
    {},
  );
  useSuccessToast(state);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Correo electrónico</CardTitle>
          <CardDescription>
            Con él entras a ReservaPrimero y te llegan los avisos. Ahora es{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormErrorBanner error={state.error} />
          {pendingEmail ? (
            <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
              Cambio pendiente a <span className="font-medium">{pendingEmail}</span>:
              abre el enlace que te enviamos para confirmarlo.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="account-email">Correo nuevo</Label>
            <Input
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-email-password">Contraseña actual</Label>
            <Input
              id="account-email-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            <FieldError messages={state.fieldErrors?.currentPassword} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Cambiar correo"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function PasswordCard() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changePassword,
    {},
  );
  useSuccessToast(state);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>
            Al cambiarla se cierra la sesión en tus otros dispositivos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormErrorBanner error={state.error} />
          <div className="grid gap-2">
            <Label htmlFor="account-current-password">Contraseña actual</Label>
            <Input
              id="account-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            <FieldError messages={state.fieldErrors?.currentPassword} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-new-password">Contraseña nueva</Label>
            <Input
              id="account-new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <FieldError messages={state.fieldErrors?.password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-confirm-password">Repite la contraseña nueva</Label>
            <Input
              id="account-confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <FieldError messages={state.fieldErrors?.confirm} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

/** Nombre, correo y contraseña del usuario logueado (cualquier rol). */
export function AccountSettings({
  fullName,
  email,
  pendingEmail,
}: {
  fullName: string;
  email: string;
  pendingEmail: string | null;
}) {
  return (
    <div className="space-y-5">
      <NameCard fullName={fullName} />
      <EmailCard email={email} pendingEmail={pendingEmail} />
      <PasswordCard />
    </div>
  );
}
