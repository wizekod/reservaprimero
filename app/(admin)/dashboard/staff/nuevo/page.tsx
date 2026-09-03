import type { Metadata } from "next";

import { StaffForm } from "@/components/staff/staff-form";

export const metadata: Metadata = { title: "Nuevo staff · ReservaPrimero" };

export default function NuevoStaffPage() {
  return <StaffForm />;
}
