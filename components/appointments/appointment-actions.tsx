"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAppointmentStatus } from "@/lib/appointments/actions";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";

const NEXT_ACTIONS: Record<
  AppointmentStatus,
  { label: string; to: AppointmentStatus; danger?: boolean }[]
> = {
  pending: [
    { label: "Confirmar", to: "confirmed" },
    { label: "Cancelar", to: "cancelled", danger: true },
  ],
  confirmed: [
    { label: "Completada", to: "completed" },
    { label: "No asistió", to: "no_show" },
    { label: "Cancelar", to: "cancelled", danger: true },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
};

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

  const actions = NEXT_ACTIONS[status];
  if (actions.length === 0) return null;

  function run(to: AppointmentStatus, danger?: boolean) {
    if (danger && !confirmCancel) {
      setConfirmCancel(true);
      setTimeout(() => setConfirmCancel(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await updateAppointmentStatus(id, to);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Error");
      setConfirmCancel(false);
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((a) => (
        <Button
          key={a.to}
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className={a.danger ? "text-destructive" : undefined}
          onClick={() => run(a.to, a.danger)}
        >
          {a.danger && confirmCancel ? "¿Seguro?" : a.label}
        </Button>
      ))}
    </div>
  );
}
