import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { clientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cliente con la `service_role` key: BYPASSA RLS. Usar SÓLO en código
 * server-side de confianza y ya autorizado (onboarding de negocio, webhooks de
 * Stripe, cron de recordatorios, acciones de superadmin, creación de reservas
 * con sus validaciones). Nunca exponer al cliente.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
