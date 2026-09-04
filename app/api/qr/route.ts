import { getMyBusiness } from "@/lib/businesses/queries";
import { bookingUrl, qrPng, qrSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

/**
 * Descarga del QR del negocio de la sesión actual. No acepta slug por
 * parámetro: siempre usa el negocio del usuario autenticado.
 */
export async function GET(request: Request) {
  const business = await getMyBusiness();
  if (!business) return new Response("No autorizado", { status: 401 });

  const { searchParams } = new URL(request.url);
  const svg = searchParams.get("format") === "svg";
  const url = bookingUrl(business.slug);
  const filename = `qr-${business.slug}.${svg ? "svg" : "png"}`;
  const disposition = `attachment; filename="${filename}"`;

  if (svg) {
    return new Response(await qrSvg(url, 1024), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": disposition,
      },
    });
  }

  const png = await qrPng(url, 1024);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": disposition,
    },
  });
}
