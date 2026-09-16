import { cn, monogram } from "@/lib/utils";

/**
 * Escrito a mano a propósito, en vez de traer el de shadcn/base-ui: todo el
 * valor de aquél está en la máquina de estados de carga de la imagen, y aquí
 * las rutas son uuid inmutables que siempre existen. Sin estado, esto se puede
 * usar desde un Server Component — que es lo que son la lista de staff y la
 * página pública de reservas.
 *
 * `alt=""` porque el nombre siempre va al lado en el DOM: la imagen decora.
 */
export function Avatar({
  src,
  name,
  color,
  square = false,
  className,
}: {
  src?: string | null;
  name: string;
  /** Fondo de las iniciales. Por defecto, gris neutro. */
  color?: string | null;
  square?: boolean;
  className?: string;
}) {
  const base = cn(
    "size-10 shrink-0 overflow-hidden",
    square ? "rounded-lg" : "rounded-full",
    className,
  );

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn(base, "bg-muted object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        base,
        "flex items-center justify-center text-xs font-semibold",
        color ? "text-white" : "bg-muted text-muted-foreground",
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {monogram(name)}
    </span>
  );
}
