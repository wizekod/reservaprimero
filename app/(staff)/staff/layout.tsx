import type { Metadata } from "next";
import { CalendarDays, PlusCircle, UserRound, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/dal";
import { pwaMetadata } from "@/lib/pwa/metadata";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getMyAccess } from "@/lib/staff/access";
import { DEFAULT_PERMISSIONS } from "@/lib/staff/permissions";
import { PanelShell, type NavItem } from "@/components/dashboard/panel-shell";
import { PushSync } from "@/components/account/push-sync";

export const metadata: Metadata = pwaMetadata;

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("staff");
  const p = (await getMyAccess())?.permissions ?? DEFAULT_PERMISSIONS;

  // El menú crece con los permisos que le dé su admin.
  const nav: NavItem[] = [
    {
      href: "/staff",
      label: p.viewAllAppointments ? "Agenda" : "Mis citas",
      icon: CalendarDays,
    },
    ...(p.bookingScope !== "none"
      ? [{ href: "/staff/nueva-reserva", label: "Nueva reserva", icon: PlusCircle }]
      : []),
    ...(p.customersScope !== "none"
      ? [{ href: "/staff/clientes", label: "Clientes", icon: Users }]
      : []),
    { href: "/staff/cuenta", label: "Mi cuenta", icon: UserRound },
  ];

  return (
    <PanelShell
      area={p.viewAllAppointments ? "Agenda" : "Mis citas"}
      userName={profile.full_name}
      roleLabel={ROLE_LABEL[profile.role]}
      nav={nav}
    >
      <PushSync />
      {children}
    </PanelShell>
  );
}
