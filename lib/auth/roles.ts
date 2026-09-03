import type { UserRole } from "@/lib/supabase/database.types";

/** Ruta "home" de cada rol tras iniciar sesión (CLAUDE.md §4, esquema de rutas por prefijo). */
export function roleHome(role: UserRole): "/dashboard" | "/staff" | "/superadmin" {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "staff":
      return "/staff";
    case "business_admin":
      return "/dashboard";
  }
}

export const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  business_admin: "Administrador de negocio",
  staff: "Staff",
};
