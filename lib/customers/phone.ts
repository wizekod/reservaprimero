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

/**
 * Dígitos que tiene un número nacional en cada país.
 *
 * No es lo mismo en todas partes: México y Argentina usan 10, España y Chile
 * 9, Uruguay y Panamá 8. Se valida contra el prefijo del negocio en vez de
 * fijar un número, o un negocio español no podría dar de alta a sus clientes.
 */
const LARGO_NACIONAL: Record<string, number> = {
  "1": 10, // EE. UU. / Rep. Dominicana
  "34": 9, // España
  "51": 9, // Perú
  "52": 10, // México
  "54": 10, // Argentina
  "56": 9, // Chile
  "57": 10, // Colombia
  "58": 10, // Venezuela
  "502": 8, // Guatemala
  "506": 8, // Costa Rica
  "507": 8, // Panamá
  "591": 8, // Bolivia
  "593": 9, // Ecuador
  "595": 9, // Paraguay
  "598": 8, // Uruguay
};

/** Cuántos dígitos se esperan, o `null` si no se sabe para ese prefijo. */
export function expectedPhoneDigits(
  dial: string | null | undefined,
): number | null {
  return dial ? (LARGO_NACIONAL[dial] ?? null) : null;
}

/**
 * Comprueba el largo del número. Devuelve el mensaje de error o `null`.
 *
 * Se mide la parte nacional: si el cliente escribe "+52 33 1234 5678", el
 * prefijo no cuenta. Sin prefijo conocido no se valida el largo, sólo que el
 * número sea reconocible.
 */
export function phoneLengthError(
  raw: string | null | undefined,
  dial: string | null | undefined,
): string | null {
  const key = phoneKey(raw, dial);
  if (!key) return "Teléfono no válido.";

  const esperados = expectedPhoneDigits(dial);
  if (!esperados) return null;

  const nacional = dial && key.startsWith(`+${dial}`)
    ? key.slice(dial.length + 1)
    : key.slice(1);

  if (nacional.length !== esperados) {
    return `El teléfono debe tener ${esperados} dígitos.`;
  }
  return null;
}
