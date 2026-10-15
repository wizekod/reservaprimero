import { getProfile, requireUser } from "@/lib/auth/dal";

import { AccountSettings } from "./account-settings";
import { PushCard } from "./push-card";

/** Sección "Mi cuenta" lista para cualquier panel: carga sus propios datos. */
export async function AccountSection() {
  const user = await requireUser();
  const profile = await getProfile();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Mi cuenta</h2>
      <AccountSettings
        fullName={profile?.full_name ?? ""}
        email={user.email ?? ""}
        pendingEmail={user.new_email ?? null}
      />
      {/* Sólo el equipo de un negocio recibe avisos; el superadmin no. */}
      {profile?.role === "business_admin" || profile?.role === "staff" ? (
        <div className="pt-2">
          <PushCard />
        </div>
      ) : null}
    </section>
  );
}
