import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Scissors,
  Users,
} from "lucide-react";

import { getProfile } from "@/lib/auth/dal";
import { getMyBusiness } from "@/lib/businesses/queries";
import { clientEnv } from "@/lib/env";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = { title: "Panel · ReservaPrimero" };

const STATUS: Record<string, { label: string; cls: string }> = {
  trial: { label: "Prueba", cls: "bg-amber-500/15 text-amber-700" },
  active: { label: "Activo", cls: "bg-emerald-500/15 text-emerald-700" },
  suspended: { label: "Suspendido", cls: "bg-destructive/15 text-destructive" },
};

const TILES = [
  { href: "/dashboard/citas", label: "Citas", desc: "Agenda del día y la semana", icon: CalendarDays },
  { href: "/dashboard/servicios", label: "Servicios", desc: "Lo que se puede reservar", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", desc: "Equipo y horarios", icon: Users },
];

export default async function DashboardPage() {
  const [profile, business] = await Promise.all([getProfile(), getMyBusiness()]);
  if (!business) return null;

  const host = new URL(clientEnv.NEXT_PUBLIC_APP_URL).host;
  const publicUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/${business.slug}`;
  const status = STATUS[business.status] ?? {
    label: business.status,
    cls: "bg-muted text-muted-foreground",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de {business.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{business.name}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}
              >
                {status.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {host}/{business.slug}
              </span>
              <CopyButton value={publicUrl} label="Copiar enlace" />
            </div>
          </div>
          <Link
            href={`/${business.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver página pública
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card-hover rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <t.icon className="size-5" />
            </div>
            <p className="mt-3 font-medium">{t.label}</p>
            <p className="text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
