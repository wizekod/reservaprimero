"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteCustomer } from "@/lib/customers/actions";
import { Button } from "@/components/ui/button";

export function CustomerRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteCustomer(id);
      if (res.ok) {
        router.push("/dashboard/clientes");
      } else {
        toast.error(res.error ?? "Error");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={remove}
      className={confirmDelete ? "text-destructive" : undefined}
    >
      {confirmDelete ? "¿Eliminar?" : "Eliminar"}
    </Button>
  );
}
