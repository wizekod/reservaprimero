"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateStaffPermissions } from "@/lib/staff/permission-actions";
import {
  PRESETS,
  normalizePermissions,
  presetOf,
  samePermissions,
  type BookingScope,
  type CustomersScope,
  type StaffPermissions,
} from "@/lib/staff/permissions";
import type { StaffStatus } from "@/lib/staff/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Qué puede ver y hacer un profesional en su panel. */
export function StaffPermissionsCard({
  staffId,
  status,
  initial,
}: {
  staffId: string;
  status: StaffStatus;
  initial: StaffPermissions;
}) {
  const [saved, setSaved] = useState(initial);
  const [perms, setPerms] = useState(initial);
  const [pending, startTransition] = useTransition();

  const preset = presetOf(perms);
  const dirty = !samePermissions(perms, saved);

  // Cada cambio pasa por las dependencias: apagar "ver todo el equipo"
  // apaga también "gestionar citas de otros", etc.
  const set = (patch: Partial<StaffPermissions>) =>
    setPerms((p) => normalizePermissions({ ...p, ...patch }));

  function save() {
    startTransition(async () => {
      const res = await updateStaffPermissions(staffId, perms);
      if (res.ok) {
        setSaved(perms);
        toast.success("Permisos guardados.");
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  return (
    <Card id="permisos">
      <CardHeader>
        <CardTitle>Permisos</CardTitle>
        <CardDescription>
          Qué puede ver y hacer en su panel, además de sus propias citas.
          {status !== "active"
            ? " Se aplicarán en cuanto entre al panel."
            : " Los cambios se aplican al momento."}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* Plantillas rápidas */}
        <div className="grid gap-2">
          <p className="text-sm font-medium">Plantilla rápida</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const active = preset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPerms(p.permissions)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
          {!preset ? (
            <p className="text-xs text-muted-foreground">
              Personalizado: no coincide con ninguna plantilla.
            </p>
          ) : null}
        </div>

        <Section title="Agenda">
          <Toggle
            checked={perms.viewAllAppointments}
            onChange={(v) => set({ viewAllAppointments: v })}
            label="Ver las citas de todo el equipo"
            hint="Solo para ver. Sin esto, únicamente ve las suyas."
          />
          <Choice<BookingScope>
            label="Crear citas"
            value={perms.bookingScope}
            onChange={(v) => set({ bookingScope: v })}
            options={[
              { value: "none", label: "No" },
              { value: "own", label: "Solo para sí" },
              { value: "any", label: "Cualquiera" },
            ]}
          />
          <Toggle
            checked={perms.manageAllAppointments}
            disabled={!perms.viewAllAppointments}
            onChange={(v) => set({ manageAllAppointments: v })}
            label="Cambiar estado y cancelar citas de otros"
            hint={
              perms.viewAllAppointments
                ? "Marcar como no asistió, cancelar o reactivar citas de sus compañeros."
                : "Requiere ver las citas de todo el equipo."
            }
          />
        </Section>

        <Section title="Clientes">
          <Choice<CustomersScope>
            label="Acceso a la sección Clientes"
            value={perms.customersScope}
            onChange={(v) => set({ customersScope: v })}
            options={[
              { value: "none", label: "No" },
              { value: "own", label: "Solo los suyos" },
              { value: "all", label: "Todos" },
            ]}
            hint="«Los suyos» son los que han tenido cita con este profesional."
          />
          <Toggle
            checked={perms.editCustomers}
            disabled={perms.customersScope === "none"}
            onChange={(v) => set({ editCustomers: v })}
            label="Crear y editar clientes"
            hint={
              perms.customersScope === "none"
                ? "Requiere acceso a la sección Clientes."
                : perms.customersScope === "own"
                  ? "Edita los suyos. Dar de alta clientes nuevos requiere acceso a todos."
                  : "Nunca puede eliminarlos; eso queda para ti."
            }
          />
          <Toggle
            checked={perms.seeCustomerContact}
            onChange={(v) => set({ seeCustomerContact: v })}
            label="Ver teléfono y correo de los clientes"
            hint="Sin esto ve el nombre y el historial, y el teléfono aparece como •••• 4521."
          />
        </Section>
      </CardContent>

      <CardFooter className="gap-3">
        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Guardando…" : "Guardar permisos"}
        </Button>
        {dirty ? (
          <button
            type="button"
            onClick={() => setPerms(saved)}
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Descartar
          </button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </label>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 overflow-hidden rounded-lg border border-border text-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "border-r border-border px-2 py-1.5 transition-colors last:border-r-0",
              value === o.value
                ? "bg-primary font-medium text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
