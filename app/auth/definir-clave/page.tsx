import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/dal";

import { DefinirClaveForm } from "./definir-clave-form";

export const metadata: Metadata = { title: "Define tu contraseña · ReservaPrimero" };

export default async function DefinirClavePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <span className="text-lg font-semibold tracking-tight">ReservaPrimero</span>
      <div className="w-full max-w-sm">
        <DefinirClaveForm email={user.email ?? ""} />
      </div>
    </div>
  );
}
