"use client";

import { useState, useTransition } from "react";

import {
  createBooking,
  fetchSlots,
  getBookableStaff,
  type BookableStaff,
} from "@/lib/booking/actions";
import type { PublicService } from "@/lib/booking/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Business = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  phone: string | null;
  address: string | null;
};

type ChosenSlot = { start: string; staffMemberId: string };

const fmtPrice = (n: number) =>
  new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(n);

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
  const [step, setStep] = useState<
    "service" | "staff" | "slot" | "details" | "done"
  >("service");

  const [service, setService] = useState<PublicService | null>(null);
  const [staffList, setStaffList] = useState<BookableStaff[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);

  const [date, setDate] = useState(minDate);
  const [tz, setTz] = useState("UTC");
  const [slots, setSlots] = useState<ChosenSlot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slot, setSlot] = useState<ChosenSlot | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: "confirmed" | "pending";
    manageUrl: string;
  } | null>(null);

  const accent = business.brand_color ?? undefined;

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
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    });

  return (
    <div
      className="mx-auto max-w-lg px-4 py-10"
      style={accent ? ({ "--brand": accent } as React.CSSProperties) : undefined}
    >
      <header className="mb-6 flex items-center gap-3">
        {business.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logo_url}
            alt=""
            className="size-10 rounded-md object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {business.name}
          </h1>
          {business.address ? (
            <p className="text-sm text-muted-foreground">{business.address}</p>
          ) : null}
        </div>
      </header>

      {step === "service" ? (
        <Card>
          <CardHeader>
            <CardTitle>Elige un servicio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este negocio aún no publicó servicios.
              </p>
            ) : (
              services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s)}
                  disabled={pending}
                  className="flex items-center justify-between rounded-lg border px-3 py-3 text-left hover:bg-muted disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium">{s.name}</span>
                    {s.description ? (
                      <span className="block text-sm text-muted-foreground">
                        {s.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {s.duration_minutes} min · {fmtPrice(s.price)}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === "staff" ? (
        <Card>
          <CardHeader>
            <CardTitle>¿Con quién?</CardTitle>
            <CardDescription>{service?.name}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <button
              type="button"
              onClick={() => pickStaff(null)}
              disabled={pending}
              className="rounded-lg border px-3 py-3 text-left hover:bg-muted disabled:opacity-50"
            >
              Cualquiera disponible
            </button>
            {staffList.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickStaff(m.id)}
                disabled={pending}
                className="rounded-lg border px-3 py-3 text-left hover:bg-muted disabled:opacity-50"
              >
                {m.display_name}
              </button>
            ))}
            {staffList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay profesionales para este servicio.
              </p>
            ) : null}
            <BackButton onClick={() => setStep("service")} />
          </CardContent>
        </Card>
      ) : null}

      {step === "slot" ? (
        <Card>
          <CardHeader>
            <CardTitle>Elige día y hora</CardTitle>
            <CardDescription>
              {service?.name}
              {staffId
                ? ` · ${staffList.find((s) => s.id === staffId)?.display_name ?? ""}`
                : " · cualquiera disponible"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Día</Label>
              <Input
                id="date"
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={(e) => {
                  setDate(e.target.value);
                  loadSlots(e.target.value, staffId);
                }}
              />
            </div>

            {pending && !slotsLoaded ? (
              <p className="text-sm text-muted-foreground">Buscando horarios…</p>
            ) : slotsLoaded && slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay horarios disponibles ese día.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <Button
                    key={s.start}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSlot(s);
                      setStep("details");
                    }}
                  >
                    {timeFmt(s.start)}
                  </Button>
                ))}
              </div>
            )}
            <BackButton onClick={() => setStep("staff")} />
          </CardContent>
        </Card>
      ) : null}

      {step === "details" && slot ? (
        <Card>
          <CardHeader>
            <CardTitle>Tus datos</CardTitle>
            <CardDescription>
              {service?.name} · {dateFmt(slot.start)} · {timeFmt(slot.start)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {formError ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              errors={errors.phone}
              type="tel"
            />
            <Field
              id="email"
              label="Correo (opcional)"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              errors={errors.email}
              type="email"
            />
            <div className="grid gap-2">
              <Label htmlFor="notes">Comentario (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              type="button"
              onClick={submit}
              disabled={pending}
              style={accent ? { backgroundColor: "var(--brand)" } : undefined}
            >
              {pending ? "Reservando…" : "Confirmar reserva"}
            </Button>
            <BackButton onClick={() => setStep("slot")} />
          </CardContent>
        </Card>
      ) : null}

      {step === "done" && result && slot ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.status === "confirmed"
                ? "¡Reserva confirmada!"
                : "Reserva recibida"}
            </CardTitle>
            <CardDescription>
              {result.status === "confirmed"
                ? "Te esperamos."
                : "El negocio confirmará tu reserva en breve."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>
              <span className="font-medium">{service?.name}</span>
              <br />
              {dateFmt(slot.start)} · {timeFmt(slot.start)}
            </p>
            <p className="text-muted-foreground">
              Guarda este enlace para cancelar o reagendar:
              <br />
              <span className="break-all">{result.manageUrl}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="justify-self-start text-sm text-muted-foreground underline underline-offset-4"
    >
      ← Atrás
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
    <div className="grid gap-2">
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
