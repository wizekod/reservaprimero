"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Buscador de clientes. Escribe el término en la URL (`?q=`) y deja que el
 * Server Component vuelva a consultar: así el resultado es compartible y
 * sobrevive a un refresco.
 */
export function CustomerSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 300);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        defaultValue={initial}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        aria-label="Buscar clientes"
        className="pl-9"
      />
    </div>
  );
}
