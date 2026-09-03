import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaffMember } from "@/lib/staff/queries";
import { listServices } from "@/lib/services/queries";
import { StaffEditor } from "@/components/staff/staff-editor";

export const metadata: Metadata = { title: "Editar staff · ReservaPrimero" };

export default async function EditarStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, services] = await Promise.all([
    getStaffMember(id),
    listServices(),
  ]);
  if (!staff) notFound();

  return <StaffEditor staff={staff} services={services} />;
}
