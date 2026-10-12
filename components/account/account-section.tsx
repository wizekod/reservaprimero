import { getProfile, requireUser } from "@/lib/auth/dal";

import { AccountSettings } from "./account-settings";

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
    </section>
  );
}
