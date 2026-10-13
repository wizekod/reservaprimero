"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/landing/logo";

const LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas", label: "Preguntas" },
];

/**
 * Cabecera de la landing: barra completa arriba del todo; al bajar se
 * convierte en una píldora flotante compacta con el CTA siempre a mano.
 */
export function SiteHeader() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="relative z-30">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted sm:inline-flex"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-opacity hover:opacity-90"
            >
              Crea tu agenda
            </Link>
          </div>
        </div>
      </header>

      <div
        aria-hidden={!compact}
        className={cn(
          "fixed inset-x-0 top-3 z-40 flex justify-center px-4 transition-all duration-300",
          compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-6 opacity-0",
        )}
      >
        <div className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/85 py-2 pr-2 pl-4 shadow-xl shadow-primary/10 backdrop-blur">
          <Logo />
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              tabIndex={compact ? 0 : -1}
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              tabIndex={compact ? 0 : -1}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Probar gratis
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
