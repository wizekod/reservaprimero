"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { setStaffPassword, updateStaffEmail } from "@/lib/staff/access-actions";
import type { FormState } from "@/lib/forms";
import type { StaffStatus } from "@/lib/staff/queries";
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

function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
  );
}

const EMAIL_COPY: Record<StaffStatus, { title: string; description: string; button: string; pending: string }> = {
  active: {
    title: "Correo de acceso",
    description: "Con este correo entra a su panel. El cambio se aplica al momento.",
    button: "Cambiar correo",
    pending: "Guardando…",
  },
  invited: {
    title: "Correo de la invitación",
    description: "Si te equivocaste de correo, cámbialo: le llega una invitación nueva y la anterior deja de servir.",
    button: "Cambiar y reenviar",
    pending: "Enviando…",
  },
  no_login: {
    title: "Dar acceso al panel",
    description: "Le enviamos una invitación para que vea su agenda y cree su contraseña.",
    button: "Enviar invitación",
    pending: "Enviando…",
  },
};

/** Correo y contraseña con los que un profesional entra a su panel. */
export function StaffAccessCard({
  staffId,
  status,
  currentEmail,
}: {
  staffId: string;
  status: StaffStatus;
  currentEmail: string | null;
}) {
  const [emailState, emailAction, emailPending] = useActionState<FormState, FormData>(
    updateStaffEmail,
    {},
  );
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(
    setStaffPassword,
    {},
  );
  const pwForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (emailState.message) toast.success(emailState.message);
  }, [emailState]);
  useEffect(() => {
    if (pwState.message) {
      toast.success(pwState.message);
      pwForm.current?.reset();
    }
  }, [pwState]);

  const copy = EMAIL_COPY[status];

  return (
    <>
      <form action={emailAction}>
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <input type="hidden" name="staffId" value={staffId} />
            <ErrorBanner error={emailState.error} />
            <div className="grid gap-2">
              <Label htmlFor="staff-access-email">Correo</Label>
              <Input
                id="staff-access-email"
                name="email"
                type="email"
                autoComplete="off"
                defaultValue={currentEmail ?? ""}
                required
              />
              <FieldError messages={emailState.fieldErrors?.email} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="outline" disabled={emailPending}>
              {emailPending ? copy.pending : copy.button}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {status === "active" ? (
        <form action={pwAction} ref={pwForm}>
          <Card>
            <CardHeader>
              <CardTitle>Contraseña</CardTitle>
              <CardDescription>
                Si la olvidó o ya no debe entrar con la de antes, ponle una
                nueva. Se cierra su sesión en todos sus dispositivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <input type="hidden" name="staffId" value={staffId} />
              <ErrorBanner error={pwState.error} />
              <div className="grid gap-2">
                <Label htmlFor="staff-access-password">Contraseña nueva</Label>
                <Input
                  id="staff-access-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <FieldError messages={pwState.fieldErrors?.password} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-access-confirm">Repite la contraseña nueva</Label>
                <Input
                  id="staff-access-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <FieldError messages={pwState.fieldErrors?.confirm} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="outline" disabled={pwPending}>
                {pwPending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}
    </>
  );
}
