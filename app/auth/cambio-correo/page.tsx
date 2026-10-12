import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Cambio de correo · ReservaPrimero" };

/**
 * Primer enlace de un cambio de correo con "Secure email change": Supabase
 * manda uno al correo actual y otro al nuevo, y el cambio no se aplica hasta
 * abrir los dos. Éste no inicia sesión, así que se explica qué falta.
 */
export default function CambioCorreoPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Enlace confirmado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Falta un paso: abre también el enlace que te enviamos a tu otro correo.
        El cambio se aplica cuando estén confirmados los dos.
      </p>
      <Link href="/login" className="text-sm font-medium underline underline-offset-4">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
