import { redirect } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Scissors,
  Settings,
  Users,
} from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getMyBusiness } from "@/lib/businesses/queries";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";

const NAV: NavItem[] = [
  { href: "/dashboard/citas", label: "Citas", icon: CalendarDays },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
];

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
      nav={NAV}
    >
      {children}
    </PanelShell>
  );
}
