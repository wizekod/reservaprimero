import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getMyBusiness } from "@/lib/businesses/queries";
import { bookingUrl, qrSvg } from "@/lib/qr";
import { clientEnv } from "@/lib/env";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Cartel QR · ReservaPrimero" };

export default async function QrPosterPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const url = bookingUrl(business.slug);
  const svg = await qrSvg(url, 420);
  const host = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/configuracion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Configuración
        </Link>
        <PrintButton label="Imprimir cartel" />
      </div>

      {/* Cartel */}
      <div className="rounded-2xl border border-border bg-white p-10 text-center text-neutral-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Reserva tu hora
        </p>
        <h1 className="mt-2 text-4xl font-bold text-neutral-900">
          {business.name}
        </h1>

        <div
          className="mx-auto mt-8 w-fit [&>svg]:block"
          aria-label={`Código QR de ${host}/${business.slug}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="mt-8 text-lg font-medium text-neutral-900">
          Escanea el código con la cámara de tu teléfono
        </p>
        <p className="mt-1 text-base text-neutral-500">
          o entra en {host}/{business.slug}
        </p>

        {business.phone ? (
          <p className="mt-6 text-sm text-neutral-500">{business.phone}</p>
        ) : null}
      </div>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        Se imprime solo el cartel; el menú y esta nota no salen en el papel.
      </p>
    </div>
  );
}
