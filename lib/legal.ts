/**
 * Datos del responsable que aparecen en el aviso de privacidad.
 *
 * La ley mexicana pide identidad y domicilio del responsable: si cambian
 * (razón social, dirección fiscal, correo), se cambian sólo aquí y se
 * actualiza `updatedAt`.
 */
export const LEGAL = {
  /** Quien opera ReservaPrimero. */
  controller: "José Carlos García",
  /** Domicilio para oír y recibir notificaciones. Vacío = no se muestra. */
  address: "",
  /** Correo para derechos ARCO y dudas de privacidad. */
  privacyEmail: "privacidad@reservaprimero.com",
  /** Fecha de la última actualización del aviso (texto ya formateado). */
  updatedAt: "23 de octubre de 2026",
} as const;
