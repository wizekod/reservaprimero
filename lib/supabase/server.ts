import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * Anon key + RLS; la sesión se lee/escribe en cookies.
 *
 * En Server Components el `setAll` puede fallar (cookies inmutables): se ignora,
 * el refresco de sesión lo hace `proxy.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component: sin acceso de escritura a cookies. OK.
          }
        },
      },
    },
  );
}
