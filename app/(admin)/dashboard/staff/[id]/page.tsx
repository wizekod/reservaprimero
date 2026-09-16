import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaffMember } from "@/lib/staff/queries";
import { listServices } from "@/lib/services/queries";
import { getMyBusiness } from "@/lib/businesses/queries";
import { StaffEditor } from "@/components/staff/staff-editor";

export const metadata: Metadata = { title: "Editar staff · ReservaPrimero" };

export default async function EditarStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [business, staff, services] = await Promise.all([
    getMyBusiness(),
    getStaffMember(id),
    listServices(),
  ]);
  if (!business || !staff) notFound();

  return (
    <StaffEditor staff={staff} services={services} businessId={business.id} />
  );
}
