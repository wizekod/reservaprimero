import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaffMember } from "@/lib/staff/queries";
import { listServices } from "@/lib/services/queries";
import { getMyBusiness } from "@/lib/businesses/queries";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // `invited_email` puede quedar viejo si cambió el correo de su cuenta; el
  // que vale para entrar es el de auth. El staff ya pasó por la RLS del
  // admin (getStaffMember), así que es de este negocio.
  let loginEmail: string | null = null;
  let isAdminAccount = false;
  if (staff.profile_id) {
    const admin = createAdminClient();
    const [{ data }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(staff.profile_id),
      admin.from("profiles").select("role").eq("id", staff.profile_id).maybeSingle(),
    ]);
    loginEmail = data.user?.email ?? null;
    // El dueño que también atiende: su acceso se cambia en Mi cuenta.
    isAdminAccount = profile?.role === "business_admin";
  }

  return (
    <StaffEditor
      staff={staff}
      services={services}
      businessId={business.id}
      loginEmail={loginEmail}
      isAdminAccount={isAdminAccount}
    />
  );
}
