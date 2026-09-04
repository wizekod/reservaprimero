"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

import { NavLink } from "@/components/dashboard/nav-link";

export type DrawerNavItem = { href: string; label: string; icon: ReactNode };

export function MobileDrawer({
  nav,
  footer,
}: {
  nav: DrawerNavItem[];
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Bloquear scroll del body y cerrar con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * El overlay va en un portal a <body>: la cabecera móvil usa
   * `backdrop-blur`, y `backdrop-filter` crea un bloque contenedor para los
   * descendientes `position: fixed`, lo que recortaría el cajón dentro de la
   * barra superior.
   */
  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              tabIndex={-1}
              className="absolute inset-0 h-full w-full cursor-default bg-foreground/40"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-sidebar shadow-2xl"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                <span className="font-semibold tracking-tight">
                  ReservaPrimero
                </span>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={() => setOpen(false)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {nav.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </nav>
              <div className="shrink-0 border-t border-border p-3">{footer}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
      >
        <Menu className="size-5" />
      </button>
      {overlay}
    </>
  );
}
