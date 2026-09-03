import type { Metadata } from "next";

import { RegistroForm } from "./registro-form";

export const metadata: Metadata = { title: "Registra tu negocio · ReservaPrimero" };

export default function RegistroPage() {
  return <RegistroForm />;
}
