import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy (antes "middleware", renombrado en Next 16).
 * Chequeo OPTIMISTA de sesión: sólo presencia de usuario, sin tocar la DB.
 * La autorización por rol vive en el `layout.tsx` de cada área vía el DAL.
 */

const AUTH_PAGES = new Set(["/login", "/registro"]);

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.has(pathname);

  // Sin sesión en un área protegida → login (con retorno).
  if (!user && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Con sesión en login/registro → fuera. El layout de cada área lo llevará
  // a su home real según el rol.
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/staff/:path*",
    "/superadmin/:path*",
    "/onboarding/:path*",
    "/login",
    "/registro",
  ],
};
