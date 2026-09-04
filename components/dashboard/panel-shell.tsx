import type { LucideIcon } from "lucide-react";
import { CalendarCheck } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/dashboard/nav-link";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Shell con barra lateral (desktop) / barra superior (móvil) para los 3 paneles. */
export function PanelShell({
  area,
  userName,
  roleLabel,
  nav,
  children,
}: {
  area: string;
  userName: string | null;
  roleLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30 lg:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">ReservaPrimero</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={<item.icon className="size-4 shrink-0" />}
            />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-xs text-muted-foreground">
            {userName ?? "—"}
          </p>
          <p className="truncate px-2 text-xs text-muted-foreground">{roleLabel}</p>
          <div className="mt-1">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Top bar móvil */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="size-4" />
            </span>
            {area}
          </span>
          <SignOutButton />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={<item.icon className="size-4 shrink-0" />}
              compact
            />
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
