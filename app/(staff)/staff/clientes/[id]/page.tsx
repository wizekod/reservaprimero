import type { Metadata } from "next";

import { requireStaffPermission } from "@/lib/staff/access";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const metadata: Metadata = { title: "Cliente · ReservaPrimero" };

export default async function StaffClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPermission((p) => p.customersScope !== "none");
  const { id } = await params;
  return <CustomerDetail access={access} id={id} />;
}
