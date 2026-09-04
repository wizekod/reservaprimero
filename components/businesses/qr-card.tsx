import Link from "next/link";
import { Download, Printer } from "lucide-react";

import { bookingUrl, qrSvg } from "@/lib/qr";
import { clientEnv } from "@/lib/env";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";

export async function QrCard({ slug }: { slug: string }) {
  const url = bookingUrl(slug);
  const svg = await qrSvg(url, 176);
  const host = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold">Código QR</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Imprímelo y ponlo en tu local: quien lo escanee llega directo a tu
        página de reservas.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="shrink-0 self-start rounded-xl border border-border bg-white p-2 [&>svg]:block"
          aria-label={`Código QR de ${host}/${slug}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Apunta a</p>
            <p className="truncate text-sm font-medium">
              {host}/{slug}
            </p>
            <CopyButton value={url} label="Copiar enlace" className="mt-1" />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Endpoints de descarga, no páginas: con <Link> se navegaría en
                cliente y no se dispararía la descarga. */}
            <a
              href="/api/qr?format=png"
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              PNG
            </a>
            <a
              href="/api/qr?format=svg"
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              SVG
            </a>
            <Link
              href="/dashboard/configuracion/qr"
              className={buttonVariants({ size: "sm" })}
            >
              <Printer className="size-4" />
              Cartel para imprimir
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            El SVG no pierde calidad al ampliarlo: úsalo para carteles grandes.
          </p>
        </div>
      </div>
    </section>
  );
}
