import { z } from "zod";

/**
 * Slugs que NO pueden usarse como nombre de negocio (chocan con rutas del
 * sistema). Debe mantenerse alineado con el CHECK `businesses_slug_not_reserved`
 * de la migración inicial (CLAUDE.md §3) + rutas añadidas después.
 */
export const RESERVED_SLUGS = new Set<string>([
  "admin",
  "superadmin",
  "staff",
  "api",
  "auth",
  "login",
  "signup",
  "registro",
  "dashboard",
  "precios",
  "pricing",
  "terminos",
  "privacidad",
  "about",
  "nosotros",
  "soporte",
  "help",
  "cron",
  "webhooks",
  // añadidas tras CLAUDE.md §3:
  "onboarding",
  "_next",
  "favicon.ico",
]);

/** Formato aceptado: 1-40 chars, minúsculas/dígitos/guiones, sin guion al borde. */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Convierte texto libre en un slug candidato (no garantiza validez de longitud). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export type SlugCheck = { ok: true } | { ok: false; reason: string };

/** Validación puramente sintáctica (formato + reservados). No consulta la DB. */
export function validateSlug(slug: string): SlugCheck {
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      reason:
        "Usa 1 a 40 caracteres: minúsculas, números y guiones (sin guion al inicio o final).",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: "Ese nombre está reservado por el sistema." };
  }
  return { ok: true };
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((s) => validateSlug(s).ok, {
    message:
      "Enlace inválido: 1 a 40 caracteres (minúsculas, números y guiones) y sin nombres reservados.",
  });
