import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CalendarCheck } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/dashboard/nav-link";
import { MobileDrawer } from "@/components/dashboard/mobile-drawer";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Shell de los paneles: barra lateral fija en desktop, cajón deslizable en
 * móvil. `area` es el nombre visible del contexto (negocio / rol).
 */
export function PanelShell({
  area,
  userName,
  roleLabel,
  nav,
  planLabel,
  publicPath,
  children,
}: {
  area: string;
  userName: string | null;
  roleLabel: string;
  nav: NavItem[];
  planLabel?: string | null;
  publicPath?: string | null;
  children: React.ReactNode;
}) {
  const rendered = nav.map((item) => ({
    href: item.href,
    label: item.label,
    icon: <item.icon className="size-4 shrink-0" />,
  }));

  const footer = (
    <>
      <p className="truncate px-2 text-sm font-medium">{userName ?? "—"}</p>
      <p className="truncate px-2 text-xs text-muted-foreground">{roleLabel}</p>
      <div className="mt-1">
        <SignOutButton />
      </div>
    </>
  );

  const brandBlock = (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold tracking-tight">{area}</p>
      <div className="flex items-center gap-1.5">
        {publicPath ? (
          <Link
            href={publicPath}
            target="_blank"
            className="truncate text-xs text-muted-foreground hover:text-primary"
          >
            {publicPath}
            <ArrowUpRight className="ml-0.5 inline size-3" />
          </Link>
        ) : null}
        {planLabel ? (
          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            {planLabel}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-svh flex-col bg-muted/30 lg:flex-row">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border bg-sidebar print:hidden lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">ReservaPrimero</span>
        </div>
        <div className="border-b border-border px-4 py-3">{brandBlock}</div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {rendered.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-border p-3">{footer}</div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur print:hidden lg:hidden">
        <MobileDrawer nav={rendered} footer={footer} />
        <div className="min-w-0 flex-1">{brandBlock}</div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 print:p-0">
        {children}
      </main>
    </div>
  );
}
