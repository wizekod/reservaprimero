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
  Search,
  Tag,
} from "lucide-react";

import {
  createBooking,
  fetchSlots,
  getBookableStaff,
  type BookableStaff,
} from "@/lib/booking/actions";
import type { PublicService } from "@/lib/booking/queries";
import { addDays, addMonths, dayOfWeek, startOfMonth } from "@/lib/availability/tz";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { mediaUrl } from "@/lib/storage/media";
import { expectedPhoneDigits } from "@/lib/customers/phone";
import { capitalizeFirst, cn, hexA } from "@/lib/utils";

type Business = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  phone: string | null;
  phone_country_code: string | null;
  address: string | null;
};

type ChosenSlot = { start: string; staffMemberId: string };
type Step = "service" | "staff" | "slot" | "details" | "done";

const STEPS: Step[] = ["service", "staff", "slot", "details", "done"];

const fmtPrice = (n: number) =>
  `$${new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(n)}`;

const monogram = (s: string) => s.trim().charAt(0).toUpperCase() || "?";

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function daysInMonth(monthFirst: string): number {
  const [y, m] = monthFirst.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** Encabezado del calendario: "Septiembre 2026". */
const monthLabel = (monthFirst: string) =>
  capitalizeFirst(
    new Date(`${monthFirst}T12:00:00Z`).toLocaleDateString("es", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  );

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
  const [month, setMonth] = useState(() => startOfMonth(minDate));
  const [query, setQuery] = useState("");
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
  const digitos = expectedPhoneDigits(business.phone_country_code);
  const accentStyle = accent
    ? ({ "--brand": accent } as React.CSSProperties)
    : undefined;
  const primaryStyle = accent ? { backgroundColor: accent } : undefined;

  const stepIndex = STEPS.indexOf(step);

  const visibleServices = query.trim()
    ? services.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : services;

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
    capitalizeFirst(
      new Date(iso).toLocaleDateString("es", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: tz,
      }),
    );
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

        {/* Pasos: los ya hechos en verde con palomita, el actual relleno. */}
        <ol className="mb-7 flex items-center">
          {STEPS.map((s, i) => {
            const hecho = i < stepIndex;
            const actual = i === stepIndex;
            return (
              <li key={s} className="flex flex-1 items-center last:flex-none">
                <span
                  aria-current={actual ? "step" : undefined}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    hecho
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : actual
                        ? "border-transparent text-white"
                        : "border-border bg-card text-muted-foreground",
                  )}
                  style={actual ? primaryStyle ?? { backgroundColor: "var(--primary)" } : undefined}
                >
                  {hecho ? <Check className="size-4" /> : i + 1}
                </span>
                {i < STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      hecho ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="space-y-4">
          {/* Paso: servicio */}
          {step === "service" ? (
            <section className="space-y-4">
              <StepHeader
                title="Elige tu servicio"
                subtitle="Selecciona el servicio que deseas reservar"
              />

              {services.length === 0 ? (
                <Panel>
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Este negocio aún no publicó servicios.
                  </p>
                </Panel>
              ) : (
                <>
                  {/* Con pocos servicios el buscador estorba más que ayuda. */}
                  {services.length > 4 ? (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar servicios..."
                        aria-label="Buscar servicios"
                        className="h-12 rounded-xl pl-11"
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4">
                    {visibleServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickService(s)}
                        disabled={pending}
                        className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
                      >
                        {s.image_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(s.image_path) ?? ""}
                            alt=""
                            aria-hidden
                            className="h-44 w-full bg-muted object-cover"
                          />
                        ) : null}
                        <span className="block p-5">
                          <span className="block text-lg font-semibold">
                            {s.name}
                          </span>
                          {s.description ? (
                            <span className="mt-0.5 block text-sm text-muted-foreground">
                              {s.description}
                            </span>
                          ) : null}
                          <span className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="size-4" />
                              {s.duration_minutes} min
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Tag className="size-4 text-muted-foreground" />
                              {fmtPrice(s.price)}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                    {visibleServices.length === 0 ? (
                      <Panel>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Ningún servicio coincide con «{query}».
                        </p>
                      </Panel>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          ) : null}

          {/* Paso: profesional */}
          {step === "staff" ? (
            <section className="space-y-4">
              <StepHeader
                title="Elige profesional"
                subtitle="Selecciona con quién quieres tu cita"
              />
              <div className="grid gap-3">
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
                    accent={m.color ?? accent}
                    avatarPath={m.avatar_path}
                  />
                ))}
                {staffList.length === 0 ? (
                  <Panel>
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay profesionales para este servicio.
                    </p>
                  </Panel>
                ) : null}
              </div>
              <BackButton onClick={() => setStep("service")} />
            </section>
          ) : null}

          {/* Paso: día y hora */}
          {step === "slot" ? (
            <section className="space-y-4">
              <StepHeader
                title="Elige fecha y hora"
                subtitle="Selecciona el día y horario que prefieras"
              />

              <Panel className="space-y-5">
                <MonthCalendar
                  month={month}
                  onMonth={setMonth}
                  selected={date}
                  minDate={minDate}
                  maxDate={maxDate}
                  accent={accent}
                  onPick={changeDate}
                />

                <div className="border-t border-border pt-5">
                  {pending && !slotsLoaded ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Buscando horarios…
                    </p>
                  ) : slotsLoaded && slots.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay horarios disponibles ese día. Prueba con otra
                      fecha.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {slots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => {
                            setSlot(s);
                            setStep("details");
                          }}
                          className="rounded-xl bg-muted py-3 text-sm font-medium tabular-nums transition-colors hover:bg-accent"
                        >
                          {timeFmt(s.start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>

              <BackButton onClick={() => setStep("staff")} />
            </section>
          ) : null}

          {/* Paso: datos */}
          {step === "details" && slot ? (
            <section className="space-y-4">
              <StepHeader
                title="Confirma tu reserva"
                subtitle="Revisa los detalles y completa tus datos"
              />

              <Panel className="divide-y divide-border">
                <SummaryRow label="Servicio" value={service?.name ?? "—"} />
                <SummaryRow label="Profesional" value={staffName} />
                <SummaryRow label="Fecha" value={dateLongFmt(slot.start)} />
                <SummaryRow label="Hora" value={timeFmt(slot.start)} />
                <SummaryRow label="Pago" value="En el establecimiento" />
                {service ? (
                  <SummaryRow label="Total" value={fmtPrice(service.price)} />
                ) : null}
              </Panel>

              {formError ? (
                <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}

              <Panel className="space-y-4">
                <Field
                  id="phone"
                  label="Teléfono"
                  type="tel"
                  placeholder="Ingresa tu teléfono"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  hint={digitos ? `${digitos} dígitos.` : undefined}
                  errors={errors.phone}
                />
                <Field
                  id="name"
                  label="Nombre completo"
                  placeholder="Ingresa tu nombre"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v.toUpperCase() })}
                  errors={errors.name}
                />
                <Field
                  id="email"
                  label="Correo electrónico (opcional)"
                  type="email"
                  placeholder="tu@correo.com"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  errors={errors.email}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Comentario (opcional)</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Algo que debamos saber"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                <TurnstileWidget onToken={setTsToken} />

                <Button
                  type="button"
                  size="lg"
                  onClick={submit}
                  disabled={pending}
                  className="w-full"
                  style={primaryStyle}
                >
                  {pending ? "Reservando…" : "Confirmar reserva"}
                </Button>
              </Panel>
              <BackButton onClick={() => setStep("slot")} />
            </section>
          ) : null}

          {/* Paso: listo */}
          {step === "done" && result && slot ? (
            <section className="space-y-4">
              <div className="text-center">
                <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-8" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  {result.status === "confirmed"
                    ? "¡Reserva confirmada!"
                    : "Reserva recibida"}
                </h2>
                <p className="mt-1 text-muted-foreground">
                  {result.status === "confirmed"
                    ? "Te esperamos."
                    : "El negocio confirmará tu reserva en breve."}
                </p>
              </div>

              <Panel className="divide-y divide-border">
                <SummaryRow label="Servicio" value={service?.name ?? "—"} />
                <SummaryRow label="Profesional" value={staffName} />
                <SummaryRow label="Fecha" value={dateLongFmt(slot.start)} />
                <SummaryRow label="Hora" value={timeFmt(slot.start)} />
              </Panel>

              <Panel>
                <p className="mb-2 text-sm text-muted-foreground">
                  Guarda este enlace para cancelar o reagendar:
                </p>
                <CopyLink url={result.manageUrl} />
              </Panel>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Título grande + subtítulo, fuera de las tarjetas. */
function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** Tarjeta blanca sobre el fondo de la página. */
function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold">{value}</dd>
    </div>
  );
}

/**
 * Calendario del mes para elegir día.
 *
 * Los días en azul son los que el negocio admite reservar (desde hoy hasta su
 * horizonte de reservas), no los que tienen hueco libre: saber eso exigiría
 * calcular la disponibilidad de los treinta días de golpe. Los huecos reales
 * aparecen abajo al elegir el día.
 */
function MonthCalendar({
  month,
  onMonth,
  selected,
  minDate,
  maxDate,
  accent,
  onPick,
}: {
  month: string;
  onMonth: (m: string) => void;
  selected: string;
  minDate: string;
  maxDate: string;
  accent?: string;
  onPick: (d: string) => void;
}) {
  const inicio = addDays(month, -dayOfWeek(month));
  const celdas = Math.ceil((dayOfWeek(month) + daysInMonth(month)) / 7) * 7;
  const dias = Array.from({ length: celdas }, (_, i) => addDays(inicio, i));

  const mesAnterior = addMonths(month, -1);
  const mesSiguiente = addMonths(month, 1);
  const puedeAtras = addDays(mesAnterior, daysInMonth(mesAnterior) - 1) >= minDate;
  const puedeAdelante = mesSiguiente <= maxDate;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{monthLabel(month)}</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes anterior"
            disabled={!puedeAtras}
            onClick={() => onMonth(mesAnterior)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mes siguiente"
            disabled={!puedeAdelante}
            onClick={() => onMonth(mesSiguiente)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {DOW.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const delMes = d.slice(0, 7) === month.slice(0, 7);
          const reservable = delMes && d >= minDate && d <= maxDate;
          const elegido = d === selected;
          return (
            <button
              key={d}
              type="button"
              disabled={!reservable}
              onClick={() => onPick(d)}
              aria-current={elegido ? "date" : undefined}
              className={cn(
                "aspect-square rounded-lg text-sm font-medium tabular-nums transition-colors",
                !delMes
                  ? "invisible"
                  : elegido
                    ? "text-white"
                    : reservable
                      ? "hover:brightness-95"
                      : "bg-muted/60 text-muted-foreground/60",
              )}
              style={
                elegido
                  ? { backgroundColor: accent ?? "var(--primary)" }
                  : reservable
                    ? accent
                      ? { backgroundColor: hexA(accent, 0.12), color: accent }
                      : { backgroundColor: "var(--primary)", color: "white" }
                    : undefined
              }
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
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
  avatarPath,
  any,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
  avatarPath?: string | null;
  any?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
    >
      {any ? (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          ★
        </span>
      ) : (
        <Avatar
          src={mediaUrl(avatarPath)}
          name={label}
          color={accent ?? "var(--primary)"}
          className="size-11"
        />
      )}
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
  hint,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  errors?: string[];
  hint?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={id === "name" ? "uppercase placeholder:normal-case" : undefined}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  );
}
