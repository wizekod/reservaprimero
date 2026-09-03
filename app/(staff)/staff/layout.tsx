import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { PanelShell } from "@/components/dashboard/panel-shell";

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
    >
      {children}
    </PanelShell>
  );
}
