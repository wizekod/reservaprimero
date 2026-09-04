import { LayoutGrid, Tags } from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";

const NAV: NavItem[] = [
  { href: "/superadmin", label: "Plataforma", icon: LayoutGrid },
  { href: "/superadmin/planes", label: "Planes", icon: Tags },
];

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("superadmin");

  return (
    <PanelShell
      area="Plataforma"
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
      nav={NAV}
    >
      {children}
    </PanelShell>
  );
}
