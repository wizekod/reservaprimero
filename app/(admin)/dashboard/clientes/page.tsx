import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMyAccess } from "@/lib/staff/access";
import { CustomersList } from "@/components/customers/customers-list";

export const metadata: Metadata = { title: "Clientes · ReservaPrimero" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, access] = await Promise.all([searchParams, getMyAccess()]);
  if (!access) notFound();
  return <CustomersList access={access} q={q} />;
}
