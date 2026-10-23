import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMyAccess } from "@/lib/staff/access";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const metadata: Metadata = { title: "Cliente · ReservaPrimero" };

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, access] = await Promise.all([params, getMyAccess()]);
  if (!access) notFound();
  return <CustomerDetail access={access} id={id} />;
}
