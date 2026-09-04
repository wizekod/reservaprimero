"use client";

import { useEffect, useState, type ReactNode } from "react";
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

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground"
      >
        <Menu className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sidebar shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold tracking-tight">ReservaPrimero</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground"
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
            <div className="border-t border-border p-3">{footer}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
