/** Días de prueba al crear un negocio (status `trial`). Ajustable. */
export const TRIAL_DAYS = 14;

/** Zonas horarias ofrecidas al crear/configurar un negocio (IANA). */
export const TIMEZONES: readonly { value: string; label: string }[] = [
  { value: "America/Santiago", label: "Chile (America/Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Monterrey", label: "México (Monterrey)" },
  { value: "America/Tijuana", label: "México (Tijuana)" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Santo_Domingo", label: "Rep. Dominicana" },
  { value: "America/New_York", label: "EE. UU. Este (New York)" },
  { value: "America/Los_Angeles", label: "EE. UU. Oeste (Los Angeles)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
];

export const TIMEZONE_VALUES = new Set(TIMEZONES.map((t) => t.value));
export const DEFAULT_TIMEZONE = "America/Santiago";
