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
