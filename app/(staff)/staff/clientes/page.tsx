import type { Metadata } from "next";

import { requireStaffPermission } from "@/lib/staff/access";
import { CustomersList } from "@/components/customers/customers-list";

export const metadata: Metadata = { title: "Clientes · ReservaPrimero" };

export default async function StaffClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await requireStaffPermission((p) => p.customersScope !== "none");
  const { q } = await searchParams;
  return <CustomersList access={access} q={q} />;
}
