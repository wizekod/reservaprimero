"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAppointmentStatus } from "@/lib/appointments/actions";
import {
  APPOINTMENT_STATUSES,
  STATUS_DOT,
  STATUS_LABEL,
} from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Cambio de estado. Se ofrecen siempre todos los estados distintos al actual:
 * el negocio tiene que poder corregir una cita ya completada o revivir una
 * cancelada. Cancelar pide confirmación porque avisa al cliente.
 */
export function AppointmentActions({
  id,
  status,
}: {
  id: string;
  status: AppointmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  function run(next: AppointmentStatus) {
    if (next === "cancelled" && !confirmCancel) {
      setConfirmCancel(true);
      setTimeout(() => setConfirmCancel(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await updateAppointmentStatus(id, next);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Error");
      setConfirmCancel(false);
    });
  }

  const options = APPOINTMENT_STATUSES.filter((s) => s !== status);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Cambiar estado a</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => run(s)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50",
              s === "cancelled" && confirmCancel && "border-destructive text-destructive",
            )}
          >
            <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
            {s === "cancelled" && confirmCancel ? "¿Seguro?" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
