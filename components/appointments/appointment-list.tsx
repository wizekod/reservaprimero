import type { AgendaAppointment } from "@/lib/appointments/queries";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/appointments/status";
import { AppointmentActions } from "@/components/appointments/appointment-actions";

export function AppointmentList({
  appointments,
  timeZone,
  showDayHeaders,
}: {
  appointments: AgendaAppointment[];
  timeZone: string;
  showDayHeaders: boolean;
}) {
  if (appointments.length === 0) {
    return (
      <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        No hay citas en este periodo.
      </p>
    );
  }

  const dayKey = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone });
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });

  const groups: { key: string; items: AgendaAppointment[] }[] = [];
  for (const a of appointments) {
    const k = dayKey(a.startAt);
    const g = groups.at(-1);
    if (g && g.key === k) g.items.push(a);
    else groups.push({ key: k, items: [a] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          {showDayHeaders ? (
            <h2 className="text-sm font-semibold capitalize text-muted-foreground">
              {dayLabel(g.items[0]!.startAt)}
            </h2>
          ) : null}
          <ul className="divide-y rounded-lg border">
            {g.items.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-3 px-4 py-3">
                <div className="w-14 shrink-0 text-sm font-medium tabular-nums">
                  {time(a.startAt)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.serviceName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.customerName}
                    {a.customerPhone ? ` · ${a.customerPhone}` : ""} ·{" "}
                    {a.staffName}
                  </p>
                  {a.notes ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      “{a.notes}”
                    </p>
                  ) : null}
                </div>
                <AppointmentActions id={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
