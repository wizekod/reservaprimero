"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteStaff } from "@/lib/staff/actions";
import { Button } from "@/components/ui/button";

export function StaffRowActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function remove() {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteStaff(id);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        setConfirm(false);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={pending}
      className={confirm ? "text-destructive" : undefined}
    >
      {confirm ? "¿Eliminar?" : "Eliminar"}
    </Button>
  );
}
