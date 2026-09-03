"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteService, setServiceActive } from "@/lib/services/actions";
import { Button } from "@/components/ui/button";

export function ServiceRowActions({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggle() {
    startTransition(async () => {
      const res = await setServiceActive(id, !active);
      if (!res.ok) toast.error(res.error ?? "Error");
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteService(id);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        disabled={pending}
      >
        {active ? "Desactivar" : "Activar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={pending}
        className={confirmDelete ? "text-destructive" : undefined}
      >
        {confirmDelete ? "¿Eliminar?" : "Eliminar"}
      </Button>
    </div>
  );
}
