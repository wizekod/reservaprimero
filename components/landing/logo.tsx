import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  wordmarkClassName,
  inverted,
}: {
  className?: string;
  /** Para ocultar el nombre en pantallas muy angostas y dejar sólo el ícono. */
  wordmarkClassName?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="ReservaPrimero"
      className={cn("flex shrink-0 items-center gap-2 font-heading text-lg font-semibold tracking-tight", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CalendarCheck className="size-4.5" />
      </span>
      <span className={cn(inverted && "text-white", wordmarkClassName)}>
        Reserva<span className="text-primary">Primero</span>
      </span>
    </Link>
  );
}
