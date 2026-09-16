import { clientEnv } from "@/lib/env";

/** Bucket de avatares del staff e imágenes de servicio (público). */
export const MEDIA_BUCKET = "media";

/** Igual que el `file_size_limit` del bucket, para avisar antes de subir. */
export const MEDIA_MAX_BYTES = 3 * 1024 * 1024;

export const MEDIA_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type MediaKind = "staff" | "services";

/**
 * Ruta pública del objeto. Se guarda la ruta y no la URL porque ésta lleva
 * dentro la referencia del proyecto Supabase: restaurar en otro proyecto o
 * servir desde un dominio propio invalidaría todas las URLs guardadas.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * La ruta llega desde un input oculto del formulario, o sea que es entrada del
 * usuario: sin esta comprobación, un admin podría apuntar la ficha (y por
 * tanto el borrado del fichero anterior) a un objeto de otro negocio.
 */
export function isOwnMediaPath(
  path: string,
  businessId: string,
  kind: MediaKind,
): boolean {
  return new RegExp(
    `^${businessId}/${kind}/${UUID}\\.(jpe?g|png|webp)$`,
    "i",
  ).test(path);
}

export function mediaPath(
  businessId: string,
  kind: MediaKind,
  ext: string,
): string {
  return `${businessId}/${kind}/${crypto.randomUUID()}.${ext}`;
}
