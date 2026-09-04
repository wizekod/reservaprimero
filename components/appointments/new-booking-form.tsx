"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  fetchSlots,
  getBookableStaff,
  type BookableStaff,
} from "@/lib/booking/actions";
import { createAppointmentAsAdmin } from "@/lib/appointments/actions";
import type { PublicService } from "@/lib/booking/queries";
import { addDays } from "@/lib/availability/tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { capitalizeFirst, cn } from "@/lib/utils";

type Slot = { start: string; staffMemberId: string };

export function NewBookingForm({
  slug,
  services,
  minDate,
  maxDate,
}: {
  slug: string;
  services: PublicService[];
  minDate: string;
  maxDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [serviceId, setServiceId] = useState("");
  const [staffList, setStaffList] = useState<BookableStaff[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(minDate);
  const [tz, setTz] = useState("UTC");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  function pickService(id: string) {
    setServiceId(id);
    setStaffId(null);
    setSlot(null);
    setSlots([]);
    setSlotsLoaded(false);
    startTransition(async () => {
      setStaffList(id ? await getBookableStaff(slug, id) : []);
    });
  }

  function loadSlots(d: string, forStaff: string | null, svc = serviceId) {
    if (!svc) return;
    setSlotsLoaded(false);
    setSlot(null);
    startTransition(async () => {
      const res = await fetchSlots(slug, svc, forStaff, d);
      if (res.ok) {
        setTz(res.timeZone);
        const seen = new Set<string>();
        const uniq: Slot[] = [];
        for (const s of res.slots) {
          if (seen.has(s.start)) continue;
          seen.add(s.start);
          uniq.push({ start: s.start, staffMemberId: s.staffMemberId });
        }
        setSlots(uniq);
      } else {
        setSlots([]);
      }
      setSlotsLoaded(true);
    });
  }

  function pickStaff(id: string | null) {
    setStaffId(id);
    loadSlots(date, id);
  }

  function changeDate(d: string) {
    if (d < minDate || d > maxDate) return;
    setDate(d);
    loadSlots(d, staffId);
  }

  function submit() {
    if (!service || !slot) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await createAppointmentAsAdmin({
        serviceId: service.id,
        staffMemberId: slot.staffMemberId,
        startISO: slot.start,
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
      });
      if (res.ok) {
        toast.success("Cita creada.");
        router.push(`/dashboard/calendario?d=${res.date}&v=dia`);
      } else {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  }

  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  const dateChip = (d: string) =>
    capitalizeFirst(
      new Date(`${d}T12:00:00Z`).toLocaleDateString("es", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {/* Servicio */}
        <Section title="1 · Servicio">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Primero crea un servicio.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    serviceId === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <span className="block text-sm font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.duration_minutes} min
                  </span>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Profesional */}
        {serviceId ? (
          <Section title="2 · Profesional">
            <div className="flex flex-wrap gap-2">
              <Chip active={staffId === null && slotsLoaded} onClick={() => pickStaff(null)}>
                Cualquiera
              </Chip>
              {staffList.map((m) => (
                <Chip
                  key={m.id}
                  active={staffId === m.id}
                  onClick={() => pickStaff(m.id)}
                >
                  {m.display_name}
                </Chip>
              ))}
            </div>
            {staffList.length === 0 && !pending ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ningún profesional realiza este servicio.
              </p>
            ) : null}
          </Section>
        ) : null}

        {/* Día y hora */}
        {serviceId && slotsLoaded ? (
          <Section title="3 · Día y hora">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Día anterior"
                disabled={pending || date <= minDate}
                onClick={() => changeDate(addDays(date, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <label className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                  {dateChip(date)}
                </span>
                <Input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => changeDate(e.target.value)}
                  className="text-transparent [&::-webkit-calendar-picker-indicator]:opacity-60"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Día siguiente"
                disabled={pending || date >= maxDate}
                onClick={() => changeDate(addDays(date, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="mt-3">
              {pending ? (
                <p className="text-sm text-muted-foreground">Buscando horarios…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  Sin horarios disponibles ese día.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={cn(
                        "rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors",
                        slot?.start === s.start
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary hover:bg-accent",
                      )}
                    >
                      {timeFmt(s.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>
        ) : null}
      </div>

      {/* Datos del cliente */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Section title="4 · Cliente">
          {formError ? (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-3">
            <Field
              id="name"
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              errors={errors.name}
            />
            <Field
              id="phone"
              label="Teléfono"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              errors={errors.phone}
            />
            <Field
              id="email"
              label="Correo (opcional)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              errors={errors.email}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Nota (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {slot ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {service?.name} · {dateChip(date)} · {timeFmt(slot.start)}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={submit}
              disabled={pending || !slot}
              className="w-full"
            >
              {pending ? "Creando…" : "Crear cita"}
            </Button>
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  errors,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  errors?: string[];
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  );
}
