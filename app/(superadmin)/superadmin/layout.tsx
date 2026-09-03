import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell } from "@/components/dashboard/panel-shell";

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
    >
      {children}
    </PanelShell>
  );
}
