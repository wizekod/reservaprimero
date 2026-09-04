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
