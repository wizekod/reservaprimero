import { SignOutButton } from "@/components/auth/sign-out-button";

/** Shell mínimo compartido por los 3 paneles (admin / staff / superadmin). */
export function PanelShell({
  area,
  userName,
  roleLabel,
  children,
}: {
  area: string;
  userName: string | null;
  roleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tracking-tight">ReservaPrimero</span>
          <span className="text-sm text-muted-foreground">/ {area}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted-foreground sm:inline">
            {userName ?? "—"} · {roleLabel}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
