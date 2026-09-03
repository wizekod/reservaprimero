import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell } from "@/components/dashboard/panel-shell";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("business_admin");

  return (
    <PanelShell
      area="Panel del negocio"
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
    >
      {children}
    </PanelShell>
  );
}
