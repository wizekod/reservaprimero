import type { Metadata } from "next";

import { slugify, validateSlug } from "@/lib/businesses/slug";

import { RegistroForm } from "./registro-form";

export const metadata: Metadata = { title: "Registra tu negocio · ReservaPrimero" };

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  // Enlace elegido en la landing; se propone en el onboarding.
  const raw = (await searchParams).negocio;
  const slug = typeof raw === "string" ? slugify(raw) : "";
  const desiredSlug = slug && validateSlug(slug).ok ? slug : undefined;

  return <RegistroForm desiredSlug={desiredSlug} />;
}
