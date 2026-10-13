import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-heading text-lg font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CalendarCheck className="size-4.5" />
      </span>
      <span className={inverted ? "text-white" : undefined}>
        Reserva<span className="text-primary">Primero</span>
      </span>
    </Link>
  );
}
