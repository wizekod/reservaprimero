"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/** Como `slugify`, pero sin recortar el guion final: si no, al teclear
 * "barberia juanito" el espacio desaparece antes de escribir la "j". */
function typingSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
}

/**
 * "reservaprimero.com/tu-negocio [Crear mi agenda]". Lleva el enlace elegido
 * a /registro, que lo guarda para proponerlo en el onboarding.
 */
export function SlugCta({ host }: { host: string }) {
  const [value, setValue] = useState("");

  return (
    <form action="/registro" method="get" className="w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg shadow-primary/5 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
        <label htmlFor="hero-slug" className="flex min-w-0 flex-1 items-center pl-3 text-base sm:text-lg">
          <span className="shrink-0 text-foreground">{host}/</span>
          <input
            id="hero-slug"
            name="negocio"
            value={value}
            onChange={(e) => setValue(typingSlug(e.target.value))}
            placeholder="tu-negocio"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-primary outline-none placeholder:text-primary/45"
          />
        </label>
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold tracking-wide text-primary-foreground uppercase shadow-md shadow-primary/30 transition-opacity hover:opacity-90 sm:px-6"
        >
          <span className="hidden sm:inline">Crear mi agenda</span>
          <span className="sm:hidden">Crear</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </form>
  );
}
