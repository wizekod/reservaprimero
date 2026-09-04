import { CalendarDays } from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";

const NAV: NavItem[] = [
  { href: "/staff", label: "Mis citas", icon: CalendarDays },
];

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
      {children}
    </PanelShell>
  );
}
