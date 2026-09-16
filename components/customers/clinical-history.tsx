"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomerNote,
  deleteCustomerNote,
  toggleNotePinned,
} from "@/lib/customers/actions";
import type { CustomerNote } from "@/lib/customers/queries";
import type { FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { capitalizeFirst, cn } from "@/lib/utils";

/**
 * Historia clínica: entradas fechadas, la más reciente arriba y las fijadas
 * por encima de todo. Se escribe desde un textarea siempre visible — en el
 * móvil, abrir un diálogo para dos líneas de nota sobra.
 */
export function ClinicalHistory({
  customerId,
  notes,
  timeZone,
}: {
  customerId: string;
  notes: CustomerNote[];
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCustomerNote,
    {},
  );

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state.message]);

  // El textarea se vacía remontándolo, no con form.reset(): Base UI avisa si
  // se le cambia por detrás el valor a un campo no controlado.
  const fieldKey = `${notes.length}-${notes[0]?.id ?? ""}`;

  const fmt = (iso: string) =>
    capitalizeFirst(
      new Date(iso).toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historia clínica</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sólo la ves tú. El equipo no tiene acceso a estas notas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="grid gap-2">
          <input type="hidden" name="customer_id" value={customerId} />
          <Textarea
            key={fieldKey}
            name="body"
            rows={3}
            maxLength={5000}
            placeholder="Qué se hizo, qué observaste, alergias, productos usados…"
            required
          />
          {state.fieldErrors?.body?.length ? (
            <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p>
          ) : null}
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Añadir entrada"}
            </Button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Sin entradas todavía.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} label={fmt(n.created_at)} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoteItem({ note, label }: { note: CustomerNote; label: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deleteCustomerNote(note.id);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        setConfirmDelete(false);
      }
    });
  }

  function pin() {
    startTransition(async () => {
      const res = await toggleNotePinned(note.id, !note.pinned);
      if (!res.ok) toast.error(res.error ?? "Error");
    });
  }

  return (
    <li
      className={cn(
        "rounded-xl border px-3.5 py-3",
        note.pinned
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card",
      )}
    >
      <p className="whitespace-pre-wrap text-sm">{note.body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {label}
          {note.authorName ? ` · ${note.authorName}` : ""}
        </span>
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={pending}
            onClick={pin}
            aria-label={note.pinned ? "Dejar de destacar" : "Destacar"}
            title={note.pinned ? "Dejar de destacar" : "Destacar"}
          >
            {note.pinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={pending}
            onClick={remove}
            className={confirmDelete ? "text-destructive" : undefined}
          >
            {confirmDelete ? "¿Eliminar?" : "Eliminar"}
          </Button>
        </span>
      </div>
    </li>
  );
}
