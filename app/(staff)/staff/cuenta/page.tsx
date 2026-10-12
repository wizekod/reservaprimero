import type { Metadata } from "next";

import { AccountSection } from "@/components/account/account-section";

export const metadata: Metadata = { title: "Mi cuenta · ReservaPrimero" };

export default function CuentaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <AccountSection />
    </div>
  );
}
