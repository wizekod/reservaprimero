import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  CreditCard,
  Home,
  PlusCircle,
  Scissors,
  Settings,
  Users,
} from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getMyBusiness } from "@/lib/businesses/queries";
import { createClient } from "@/lib/supabase/server";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/nueva-reserva", label: "Nueva Reserva", icon: PlusCircle },
  { href: "/dashboard/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/dashboard/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/bloquear-horario", label: "Bloquear horario", icon: CalendarOff },
  { href: "/dashboard/suscripcion", label: "Mi suscripción", icon: CreditCard },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("business_admin");
  const business = await getMyBusiness();
  if (!business) redirect("/onboarding");

  let planLabel: string | null = null;
  if (business.plan_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select("name")
      .eq("id", business.plan_id)
      .maybeSingle();
    planLabel = data?.name ?? null;
  }

  return (
    <PanelShell
      area={business.name}
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
      nav={NAV}
      planLabel={planLabel}
      publicPath={`/${business.slug}`}
    >
      {children}
    </PanelShell>
  );
}
