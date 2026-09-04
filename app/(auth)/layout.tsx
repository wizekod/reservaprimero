import Link from "next/link";
import { CalendarCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Panel de marca (solo desktop) */}
      <div className="bg-aurora relative hidden flex-col justify-between border-r border-border p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-4" />
          </span>
          ReservaPrimero
        </Link>
        <div>
          <p className="max-w-sm text-2xl font-semibold leading-snug tracking-tight">
            La agenda que trabaja por ti mientras tú atiendes.
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Reservas online, recordatorios automáticos y cero dobles reservas.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ReservaPrimero
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight lg:hidden"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-4" />
          </span>
          ReservaPrimero
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
