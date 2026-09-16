"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  MEDIA_BUCKET,
  MEDIA_MAX_BYTES,
  MEDIA_MIME,
  mediaPath,
  mediaUrl,
  type MediaKind,
} from "@/lib/storage/media";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Reescala en el navegador antes de subir. Una foto de móvil pesa 3-5 MB y
 * aquí se enseña a 40-64 px: bajarla a `max` px deja unos 50-150 KB, sube
 * rápido con datos móviles y evita tener que optimizar nada en el servidor.
 */
async function downscale(file: File, max: number): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    // `imageOrientation` respeta el EXIF: sin esto, las fotos verticales de
    // iPhone salen giradas.
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/webp", 0.82),
    );
  } catch {
    // Un HEIC que se cuele por el `accept` hace fallar a createImageBitmap:
    // se sube el original y que lo rechace el bucket con su mensaje.
    return file;
  }
}

/**
 * Sube directo del navegador a Storage con la sesión del usuario, así que la
 * política de `storage.objects` es el control real de cada subida. El campo
 * sólo transporta la RUTA resultante en un input oculto; la acción de servidor
 * la valida contra el negocio antes de guardarla.
 */
export function ImageField({
  name,
  kind,
  businessId,
  defaultPath,
  label,
  fallbackName,
  color,
  square = false,
  maxPx = 512,
  onBusyChange,
}: {
  name: string;
  kind: MediaKind;
  businessId: string;
  defaultPath?: string | null;
  label: string;
  fallbackName: string;
  color?: string | null;
  square?: boolean;
  maxPx?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(defaultPath ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    if (!MEDIA_MIME.includes(file.type as (typeof MEDIA_MIME)[number])) {
      setError("Formato no admitido. Usa JPG, PNG o WebP.");
      return;
    }
    if (file.size > MEDIA_MAX_BYTES * 4) {
      setError("La imagen es demasiado grande.");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy(true);
    onBusyChange?.(true);

    try {
      const blob = await downscale(file, maxPx);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const target = mediaPath(businessId, kind, ext);
      const { error: upErr } = await createClient()
        .storage.from(MEDIA_BUCKET)
        .upload(target, blob, {
          contentType: blob.type,
          cacheControl: "31536000",
        });
      if (upErr) {
        setError("No se pudo subir la imagen.");
        setPreview(null);
      } else {
        // El objeto anterior lo borra la acción de servidor, y sólo si el
        // guardado sale bien: borrarlo aquí dejaría la ficha apuntando a nada.
        setPath(target);
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function clear() {
    setPath(null);
    setPreview(null);
    setError(null);
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Avatar
          src={preview ?? mediaUrl(path)}
          name={fallbackName}
          color={color}
          square={square}
          className="size-16"
        />
        <input type="hidden" name={name} value={path ?? ""} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleChange}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Subiendo…" : path ? "Cambiar foto" : "Subir foto"}
          </Button>
          {path ? (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
