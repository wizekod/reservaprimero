import "server-only";

import QRCode from "qrcode";

import { clientEnv } from "@/lib/env";

/** URL pública de reservas del negocio, que es lo que codifica el QR. */
export function bookingUrl(slug: string): string {
  return `${clientEnv.NEXT_PUBLIC_APP_URL}/${slug}`;
}

/**
 * Se genera en negro sobre blanco a propósito: teñirlo con el color de marca
 * reduce el contraste y hace que algunos lectores fallen, sobre todo impreso.
 */
const COLORS = { dark: "#0a0a0a", light: "#ffffff" };

export function qrSvg(text: string, width = 256): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
    color: COLORS,
  });
}

export function qrPng(text: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width,
    margin: 2,
    errorCorrectionLevel: "M",
    color: COLORS,
  });
}
