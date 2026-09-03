import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">ReservaPrimero</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          La agenda de citas online para tu barbería, salón, spa o consulta. Tus
          clientes reservan solos, sin llamadas ni apps.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/registro" className={buttonVariants()}>
          Registra tu negocio
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
