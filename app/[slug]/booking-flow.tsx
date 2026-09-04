"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  MapPin,
} from "lucide-react";

import {
  createBooking,
  fetchSlots,
  getBookableStaff,
  type BookableStaff,
} from "@/lib/booking/actions";
import type { PublicService } from "@/lib/booking/queries";
import { addDays } from "@/lib/availability/tz";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Business = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  phone: string | null;
  address: string | null;
};

type ChosenSlot = { start: string; staffMemberId: string };
type Step = "service" | "staff" | "slot" | "details" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Servicio" },
  { key: "staff", label: "Profesional" },
  { key: "slot", label: "Hora" },
  { key: "details", label: "Datos" },
];

const fmtPrice = (n: number) =>
  new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(n);

const monogram = (s: string) => s.trim().charAt(0).toUpperCase() || "?";

export function BookingFlow({
  slug,
  business,
  services,
  minDate,
  maxDate,
}: {
  slug: string;
  business: Business;
  services: PublicService[];
  minDate: string;
  maxDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("service");

  const [service, setService] = useState<PublicService | null>(null);
  const [staffList, setStaffList] = useState<BookableStaff[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);

  const [date, setDate] = useState(minDate);
  const [tz, setTz] = useState("UTC");
  const [slots, setSlots] = useState<ChosenSlot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slot, setSlot] = useState<ChosenSlot | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [tsToken, setTsToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: "confirmed" | "pending";
    manageUrl: string;
  } | null>(null);

  const accent = business.brand_color ?? undefined;
  const accentStyle = accent
    ? ({ "--brand": accent } as React.CSSProperties)
    : undefined;
  const primaryStyle = accent ? { backgroundColor: accent } : undefined;

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function pickService(s: PublicService) {
    setService(s);
    setStaffId(null);
    startTransition(async () => {
      setStaffList(await getBookableStaff(slug, s.id));
      setStep("staff");
    });
  }

  function loadSlots(forDate: string, forStaff: string | null) {
    setSlotsLoaded(false);
    setSlot(null);
    startTransition(async () => {
      const res = await fetchSlots(slug, service!.id, forStaff, forDate);
      if (res.ok) {
        setTz(res.timeZone);
        const seen = new Set<string>();
        const uniq: ChosenSlot[] = [];
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
    setStep("slot");
    loadSlots(date, id);
  }

  function changeDate(d: string) {
    if (d < minDate || d > maxDate) return;
    setDate(d);
    loadSlots(d, staffId);
  }

  function submit() {
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await createBooking({
        slug,
        serviceId: service!.id,
        staffMemberId: slot!.staffMemberId,
        startISO: slot!.start,
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        turnstileToken: tsToken,
      });
      if (res.ok) {
        setResult({ status: res.status, manageUrl: res.manageUrl });
        setStep("done");
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
  const dateLongFmt = (iso: string) =>
    new Date(iso).toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    });
  const dateChipFmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("es", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const staffName = staffId
    ? (staffList.find((s) => s.id === staffId)?.display_name ?? "")
    : "Cualquiera disponible";

  return (
    <div className="bg-aurora min-h-svh" style={accentStyle}>
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        {/* Cabecera del negocio */}
        <header className="mb-6 flex items-center gap-3">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt=""
              className="size-12 rounded-xl border border-border object-cover"
            />
          ) : (
            <span
              className="flex size-12 items-center justify-center rounded-xl text-lg font-semibold text-white"
              style={{ backgroundColor: accent ?? "var(--primary)" }}
            >
              {monogram(business.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {business.name}
            </h1>
            {business.address ? (
              <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {business.address}
              </p>
            ) : null}
          </div>
        </header>

        {/* Indicador de pasos */}
        {step !== "done" ? (
          <ol className="mb-4 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-1 flex-col gap-1.5">
                <span
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    i <= stepIndex ? "bg-primary" : "bg-border",
                  )}
                  style={i <= stepIndex && accent ? primaryStyle : undefined}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    i === stepIndex
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {/* Paso: servicio */}
          {step === "service" ? (
            <section className="space-y-3">
              <h2 className="font-semibold">Elige un servicio</h2>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este negocio aún no publicó servicios.
                </p>
              ) : (
                <div className="grid gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickService(s)}
                      disabled={pending}
                      className="group flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.name}</span>
                        {s.description ? (
                          <span className="block truncate text-sm text-muted-foreground">
                            {s.description}
                          </span>
                        ) : null}
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {s.duration_minutes} min
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {fmtPrice(s.price)}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Paso: profesional */}
          {step === "staff" ? (
            <section className="space-y-3">
              <h2 className="font-semibold">¿Con quién?</h2>
              <p className="text-sm text-muted-foreground">{service?.name}</p>
              <div className="grid gap-2">
                <StaffOption
                  label="Cualquiera disponible"
                  hint="Te asignamos el primer hueco libre"
                  onClick={() => pickStaff(null)}
                  disabled={pending}
                  accent={accent}
                  any
                />
                {staffList.map((m) => (
                  <StaffOption
                    key={m.id}
                    label={m.display_name}
                    onClick={() => pickStaff(m.id)}
                    disabled={pending}
                    accent={accent}
                  />
                ))}
                {staffList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay profesionales para este servicio.
                  </p>
                ) : null}
              </div>
              <BackButton onClick={() => setStep("service")} />
            </section>
          ) : null}

          {/* Paso: día y hora */}
          {step === "slot" ? (
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">Elige día y hora</h2>
                <p className="text-sm text-muted-foreground">
                  {service?.name} · {staffName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pending || date <= minDate}
                  onClick={() => changeDate(addDays(date, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <label className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium capitalize">
                    {dateChipFmt(date)}
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
                  disabled={pending || date >= maxDate}
                  onClick={() => changeDate(addDays(date, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {pending && !slotsLoaded ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Buscando horarios…
                </p>
              ) : slotsLoaded && slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No hay horarios disponibles ese día.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => {
                        setSlot(s);
                        setStep("details");
                      }}
                      className="rounded-lg border border-border py-2 text-sm font-medium tabular-nums transition-colors hover:border-primary hover:bg-accent"
                    >
                      {timeFmt(s.start)}
                    </button>
                  ))}
                </div>
              )}
              <BackButton onClick={() => setStep("staff")} />
            </section>
          ) : null}

          {/* Paso: datos */}
          {step === "details" && slot ? (
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">Tus datos</h2>
                <p className="text-sm capitalize text-muted-foreground">
                  {service?.name} · {dateLongFmt(slot.start)} · {timeFmt(slot.start)}
                </p>
              </div>

              {formError ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}

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
                <Label htmlFor="notes">Comentario (opcional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <TurnstileWidget onToken={setTsToken} />

              <Button
                type="button"
                onClick={submit}
                disabled={pending}
                className="w-full"
                style={primaryStyle}
              >
                {pending ? "Reservando…" : "Confirmar reserva"}
              </Button>
              <BackButton onClick={() => setStep("slot")} />
            </section>
          ) : null}

          {/* Paso: confirmación */}
          {step === "done" && result && slot ? (
            <section className="space-y-4 text-center">
              <span
                className="mx-auto flex size-14 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: accent ?? "var(--primary)" }}
              >
                <Check className="size-7" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {result.status === "confirmed"
                    ? "¡Reserva confirmada!"
                    : "Reserva recibida"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {result.status === "confirmed"
                    ? "Te esperamos."
                    : "El negocio confirmará tu reserva en breve."}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-left text-sm">
                <p className="font-medium">{service?.name}</p>
                <p className="capitalize text-muted-foreground">
                  {dateLongFmt(slot.start)} · {timeFmt(slot.start)}
                </p>
                <p className="text-muted-foreground">con {staffName}</p>
              </div>

              <div className="text-left">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Guarda este enlace para cancelar o reagendar:
                </p>
                <CopyLink url={result.manageUrl} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StaffOption({
  label,
  hint,
  onClick,
  disabled,
  accent,
  any,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
  any?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          any ? "bg-muted text-muted-foreground" : "text-white",
        )}
        style={any ? undefined : { backgroundColor: accent ?? "var(--primary)" }}
      >
        {any ? "★" : label.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Atrás
    </button>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
          () => {},
        );
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs"
    >
      <span className="min-w-0 flex-1 truncate">{url}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-primary" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-muted-foreground" />
      )}
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
