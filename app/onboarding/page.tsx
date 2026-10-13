import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser, requireRole } from "@/lib/auth/dal";
import { getMyBusiness } from "@/lib/businesses/queries";
import { clientEnv } from "@/lib/env";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Configura tu negocio · ReservaPrimero" };

export default async function OnboardingPage() {
  await requireRole("business_admin");
  if (await getMyBusiness()) redirect("/dashboard");

  const hostBase = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;
  const desired = (await getUser())?.user_metadata?.desired_slug;
  return (
    <OnboardingForm
      hostBase={hostBase}
      initialSlug={typeof desired === "string" ? desired : undefined}
    />
  );
}
