import type { AppointmentStatus } from "@/lib/supabase/database.types";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const STATUS_BADGE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  confirmed: "bg-emerald-500/15 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  no_show: "bg-destructive/15 text-destructive",
};
