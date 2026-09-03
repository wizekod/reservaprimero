import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyBusiness } from "@/lib/businesses/queries";
import { clientEnv } from "@/lib/env";

import { ConfiguracionForm } from "./configuracion-form";

export const metadata: Metadata = { title: "Configuración · ReservaPrimero" };

export default async function ConfiguracionPage() {
  const business = await getMyBusiness();
  if (!business) redirect("/onboarding");

  const hostBase = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;
  return <ConfiguracionForm business={business} hostBase={hostBase} />;
}
