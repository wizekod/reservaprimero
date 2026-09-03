import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getMyBusiness } from "@/lib/businesses/queries";
import { PanelShell } from "@/components/dashboard/panel-shell";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("business_admin");
  const business = await getMyBusiness();
  if (!business) redirect("/onboarding");

  return (
    <PanelShell
      area={business.name}
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
    >
      {children}
    </PanelShell>
  );
}
