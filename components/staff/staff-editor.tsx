"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  resendInvite,
  setStaffServices,
  updateStaff,
} from "@/lib/staff/actions";
import type { FormState } from "@/lib/forms";
import type { ServiceRow } from "@/lib/supabase/database.types";
import type { StaffMemberWithMeta } from "@/lib/staff/queries";
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

const STATUS_TEXT: Record<StaffMemberWithMeta["status"], string> = {
  active: "Con acceso al panel",
  invited: "Invitación enviada",
  no_login: "Sin acceso al panel",
};

export function StaffEditor({
  staff,
  services,
}: {
  staff: StaffMemberWithMeta;
  services: ServiceRow[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateStaff,
    {},
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(staff.service_ids),
  );
  const [savingSvcs, startSvcs] = useTransition();
  const [resending, startResend] = useTransition();

  function toggleService(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveServices() {
    startSvcs(async () => {
      const res = await setStaffServices(staff.id, [...selected]);
      toast[res.ok ? "success" : "error"](
        res.ok ? "Servicios actualizados." : res.error ?? "Error",
      );
    });
  }

  function doResend() {
    startResend(async () => {
      const res = await resendInvite(staff.id);
      toast[res.ok ? "success" : "error"](
        res.ok ? "Invitación reenviada." : res.error ?? "Error",
      );
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/dashboard/staff"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Staff
      </Link>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
            <CardDescription>{STATUS_TEXT[staff.status]}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <input type="hidden" name="id" value={staff.id} />
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
                defaultValue={staff.display_name}
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={staff.active}
                className="size-4"
              />
              Activo (aparece en la página de reservas)
            </label>

            {staff.status === "invited" && staff.invited_email ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Invitado: {staff.invited_email}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={doResend}
                  disabled={resending}
                >
                  {resending ? "Enviando…" : "Reenviar"}
                </Button>
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar datos"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Servicios que realiza</CardTitle>
          <CardDescription>
            Solo estos aparecerán como opción al reservar con este profesional.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Primero crea servicios.
            </p>
          ) : (
            services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selected.has(s.id)}
                  onChange={() => toggleService(s.id)}
                />
                {s.name}
                {!s.active ? (
                  <span className="text-xs text-muted-foreground">(inactivo)</span>
                ) : null}
              </label>
            ))
          )}
        </CardContent>
        {services.length > 0 ? (
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={saveServices}
              disabled={savingSvcs}
            >
              {savingSvcs ? "Guardando…" : "Guardar servicios"}
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
