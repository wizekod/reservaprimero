import type { Metadata } from "next";
import { CalendarDays, UserRound } from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { pwaMetadata } from "@/lib/pwa/metadata";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";
import { PushSync } from "@/components/account/push-sync";

const NAV: NavItem[] = [
  { href: "/staff", label: "Mis citas", icon: CalendarDays },
  { href: "/staff/cuenta", label: "Mi cuenta", icon: UserRound },
];

export const metadata: Metadata = pwaMetadata;

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("staff");

  return (
    <PanelShell
      area="Mis citas"
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
      nav={NAV}
    >
      <PushSync />
      {children}
    </PanelShell>
  );
}
