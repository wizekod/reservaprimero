/**
 * Paleta para identificar a cada profesional en el calendario.
 *
 * Son hex y no los tokens `--chart-*` de globals.css porque el color se guarda
 * en la base y viaja en un `style` inline: tiene que ser un valor literal, no
 * una variable CSS que sólo existe en el navegador.
 *
 * Elegidos con saturación media para que el texto se lea encima tanto en el
 * tema claro como en el oscuro, donde el bloque se pinta con alfa.
 */
export const STAFF_COLORS = [
  "#6366f1", // índigo
  "#10b981", // esmeralda
  "#f59e0b", // ámbar
  "#ec4899", // rosa
  "#0ea5e9", // cielo
  "#8b5cf6", // violeta
  "#14b8a6", // turquesa
  "#f43f5e", // rojo coral
] as const;

/**
 * Siguiente color libre del negocio. Si ya se usaron todos, se sigue en
 * orden: repetir es mejor que dejar a alguien sin color.
 */
export function nextStaffColor(used: (string | null)[]): string {
  const taken = new Set(used.filter(Boolean).map((c) => c!.toLowerCase()));
  return (
    STAFF_COLORS.find((c) => !taken.has(c)) ??
    STAFF_COLORS[taken.size % STAFF_COLORS.length] ??
    STAFF_COLORS[0]
  );
}
