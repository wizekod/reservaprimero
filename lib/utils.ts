import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Primera letra en mayúscula. `toLocaleDateString("es")` devuelve los días y
 * meses en minúscula; la clase `capitalize` de CSS no sirve porque afecta a
 * cada palabra ("5 De Septiembre") y `::first-letter` no aplica en
 * contenedores flex/inline.
 */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Importe con símbolo y dos decimales: `$1,250.00`.
 *
 * Único formateador de dinero de la app, para que el precio de un servicio se
 * vea igual en la lista del panel, en la página de reservas y en las
 * estadísticas.
 *
 * Se fija la convención de México y buena parte de LatAm —coma para los miles,
 * punto para los decimales—: no hay ajuste de moneda por negocio, y uno
 * español esperaría "1.250,00 €". El día que haga falta, esto es lo único que
 * hay que tocar.
 */
export function formatMoney(n: number): string {
  return `$${new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`
}

/**
 * Iniciales para cuando no hay foto. Dos para una persona ("Ana García" → AG)
 * y una sola para un nombre de una palabra.
 */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase()
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase()
}

/**
 * `#rrggbb` + alfa → `rgb(r g b / a)`. El color del profesional es un hex
 * arbitrario guardado en la base, así que no puede venir de una clase de
 * Tailwind: se compone aquí para el `style` inline del bloque del calendario.
 */
export function hexA(hex: string, alpha: number): string {
  const v = hex.trim()
  if (!/^#[0-9a-f]{6}$/i.test(v)) return `rgb(0 0 0 / ${alpha})`
  const n = parseInt(v.slice(1), 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
}
