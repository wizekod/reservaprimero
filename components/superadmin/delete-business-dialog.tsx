"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteBusiness } from "@/lib/superadmin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteBusinessDialog({
  id,
  name,
  slug,
}: {
  id: string;
  name: string;
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === slug;

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setTyped("");
  }

  function run() {
    startTransition(async () => {
      const res = await deleteBusiness(id, typed);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      if (res.error) toast.warning(res.error);
      else toast.success(`${name} borrado.`);
      setOpen(false);
      setTyped("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        Borrar
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Borrar {name}</DialogTitle>
          <DialogDescription>
            Se borran para siempre sus servicios, staff, horarios, clientes,
            historia clínica, citas e imágenes, y las cuentas de su dueño y
            su staff. Si tiene suscripción en Stripe, se cancela. No se puede
            deshacer.
          </DialogDescription>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches && !pending) run();
            }}
          >
            <Label htmlFor={`confirm-${id}`}>
              Escribe <span className="font-mono font-semibold">{slug}</span>{" "}
              para confirmar
            </Label>
            <Input
              id={`confirm-${id}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
            />
            <DialogFooter className="mt-2">
              <DialogClose
                render={<Button type="button" variant="outline" />}
                disabled={pending}
              >
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                disabled={!matches || pending}
              >
                {pending ? "Borrando…" : "Borrar negocio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
