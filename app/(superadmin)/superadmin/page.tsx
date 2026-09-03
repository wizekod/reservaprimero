import type { Metadata } from "next";
import Link from "next/link";

import {
  getPlatformMetrics,
  listBusinessesForAdmin,
} from "@/lib/superadmin/queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BusinessStatusActions } from "@/components/superadmin/business-status-actions";

export const metadata: Metadata = { title: "Plataforma · ReservaPrimero" };

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700",
  trial: "bg-amber-500/15 text-amber-700",
  suspended: "bg-destructive/15 text-destructive",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  trial: "Prueba",
  suspended: "Suspendido",
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

export default async function SuperadminPage() {
  const [metrics, businesses] = await Promise.all([
    getPlatformMetrics(),
    listBusinessesForAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
        <Link
          href="/superadmin/planes"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Planes
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Metric label="Negocios" value={metrics.total} />
        <Metric label="Activos" value={metrics.active} />
        <Metric label="En prueba" value={metrics.trial} />
        <Metric label="Suspendidos" value={metrics.suspended} />
        <Metric label="Citas" value={metrics.appointments} />
        <Metric label="MRR estimado" value={metrics.mrr} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Negocio</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Citas</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {businesses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Aún no hay negocios.
                </td>
              </tr>
            ) : (
              businesses.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{b.name}</div>
                    <a
                      href={`/${b.slug}`}
                      className="text-xs text-muted-foreground underline underline-offset-2"
                    >
                      /{b.slug}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {b.planName ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{b.appointmentCount}</td>
                  <td className="px-3 py-2 text-right">
                    <BusinessStatusActions id={b.id} status={b.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
