/**
 * Clave de identidad de un cliente dentro de un negocio, en E.164.
 *
 * Réplica exacta de la función SQL `customer_phone_key`
 * (supabase/migrations/20260915121000_customer_upsert_rpc.sql). La base la
 * calcula por trigger al escribir; esto sirve para *buscar* desde el panel.
 * Si cambia una, hay que cambiar la otra.
 *
 * Devuelve `null` si el número no es canonizable: un teléfono basura no vale
 * como identidad y es preferible dejarlo fuera del índice único a fusionar
 * por error dos fichas que no tienen nada que ver.
 */
export function phoneKey(
  raw: string | null | undefined,
  dial: string | null | undefined,
): string | null {
  if (raw == null) return null;

  let s = raw.replace(/[^0-9+]/g, "");
  if (s === "") return null;

  // El 00 de marcación internacional equivale al '+'.
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  if (s.startsWith("+")) {
    // Internacional explícito: el prefijo ya viene en el número.
    s = `+${s.slice(1).replace(/[^0-9]/g, "")}`;
  } else {
    // Nacional: se quita el prefijo de salida (el 0 de Argentina; en España
    // ningún número empieza por 0) y se antepone el del país del negocio.
    s = s.replace(/[^0-9]/g, "").replace(/^0+/, "");
    if (!dial || s === "") return null;
    s = `+${dial}${s}`;
  }

  return /^\+[1-9][0-9]{6,14}$/.test(s) ? s : null;
}
