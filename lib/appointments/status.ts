import type { AppointmentStatus } from "@/lib/supabase/database.types";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

/** Píldoras de estado (paneles, listas, detalle). */
export const STATUS_BADGE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  confirmed: "bg-emerald-500/15 text-emerald-700",
  completed: "bg-sky-500/15 text-sky-700",
  cancelled: "bg-muted text-muted-foreground line-through",
  no_show: "bg-destructive/15 text-destructive",
};

/**
 * Franja izquierda del bloque del calendario: codifica el ESTADO, mientras el
 * relleno codifica al profesional. Son colores de borde, no de fondo.
 */
export const STATUS_STRIPE: Record<AppointmentStatus, string> = {
  pending: "border-l-amber-500",
  confirmed: "border-l-emerald-500",
  completed: "border-l-sky-500",
  cancelled: "border-l-muted-foreground/40",
  no_show: "border-l-destructive",
};

/** Bloques sin color de profesional asignado: se cae al color del estado. */
export const STATUS_BLOCK: Record<AppointmentStatus, string> = {
  pending: "border-amber-500/50 bg-amber-500/15 text-foreground",
  confirmed: "border-emerald-500/50 bg-emerald-500/15 text-foreground",
  completed: "border-sky-500/50 bg-sky-500/15 text-foreground",
  cancelled:
    "border-border bg-muted text-muted-foreground line-through opacity-70",
  no_show: "border-destructive/50 bg-destructive/15 text-destructive",
};

/** Cuadrito de color para la leyenda. */
export const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-emerald-500",
  completed: "bg-sky-500",
  cancelled: "bg-muted-foreground/40",
  no_show: "bg-destructive",
};
