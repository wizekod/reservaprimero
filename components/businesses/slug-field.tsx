"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { checkSlug } from "@/lib/businesses/actions";
import { slugify, validateSlug } from "@/lib/businesses/slug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "error"; reason: string };

export function SlugField({
  hostBase,
  defaultValue = "",
  exceptSelf = false,
  serverError,
}: {
  hostBase: string;
  defaultValue?: string;
  exceptSelf?: boolean;
  serverError?: string[];
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runCheck = useCallback(
    (raw: string) => {
      if (timer.current) clearTimeout(timer.current);
      const slug = raw.trim().toLowerCase();

      if (!slug || slug === defaultValue) {
        setStatus({ kind: "idle" });
        return;
      }
      const syntax = validateSlug(slug);
      if (!syntax.ok) {
        setStatus({ kind: "error", reason: syntax.reason });
        return;
      }
      setStatus({ kind: "checking" });
      timer.current = setTimeout(() => {
        startTransition(async () => {
          const res = await checkSlug(slug, exceptSelf);
          setStatus(
            res.available
              ? { kind: "ok" }
              : { kind: "error", reason: res.reason ?? "No disponible." },
          );
        });
      }, 400);
    },
    [defaultValue, exceptSelf],
  );

  return (
    <div className="grid gap-2">
      <Label htmlFor="slug">Enlace público</Label>
      <div className="flex items-center rounded-lg border border-input pl-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <span className="text-sm text-muted-foreground">{hostBase}/</span>
        <Input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            runCheck(e.target.value);
          }}
          onBlur={(e) => {
            const cleaned = slugify(e.target.value);
            setValue(cleaned);
            runCheck(cleaned);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="border-0 pl-1 shadow-none focus-visible:border-0 focus-visible:ring-0"
          placeholder="mi-negocio"
        />
      </div>
      {status.kind === "checking" ? (
        <p className="text-sm text-muted-foreground">Comprobando disponibilidad…</p>
      ) : null}
      {status.kind === "ok" ? (
        <p className="text-sm text-emerald-600">Disponible.</p>
      ) : null}
      {status.kind === "error" ? (
        <p className="text-sm text-destructive">{status.reason}</p>
      ) : null}
      {serverError?.length ? (
        <p className="text-sm text-destructive">{serverError[0]}</p>
      ) : null}
    </div>
  );
}
