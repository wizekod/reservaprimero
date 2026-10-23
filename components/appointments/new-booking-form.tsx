"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getBookableStaff, type BookableStaff } from "@/lib/booking/actions";
import {
  createAppointmentFromPanel,
  fetchPanelSlots,
} from "@/lib/appointments/actions";
import { lookupCustomerByPhone } from "@/lib/customers/actions";
import type { PublicService } from "@/lib/booking/queries";
import {
  addDays,
  addMonths,
  startOfMonth,
  zonedDateAndMinutes,
} from "@/lib/availability/tz";
import { MonthCalendar, SlotGrid } from "@/components/booking/month-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { expectedPhoneDigits, phoneLengthError } from "@/lib/customers/phone";
import { capitalizeFirst, cn } from "@/lib/utils";

/** `stationsFull`: profesional libre pero sin estación (sólo le llega al admin). */
type Slot = { start: string; staffMemberId: string; stationsFull?: boolean };

export function NewBookingForm({
  slug,
  services,
  minDate,
  maxDate,
  dialCode,
  agendaPath,
  onlyStaffId = null,
}: {
  slug: string;
  services: PublicService[];
  minDate: string;
  maxDate: string;
  dialCode: string | null;
  /** A dónde volver tras crear la cita (calendario del admin o del staff). */
  agendaPath: string;
  /** Profesional con permiso "sólo para sí": su agenda y ninguna otra. */
  onlyStaffId?: string | null;
}) {
  const digitos = expectedPhoneDigits(dialCode);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Reconocer al cliente va aparte: si compartiera `pending`, mientras se
  // busca el teléfono se ocultarían los horarios y el botón diría "Creando…".
  const [, startLookup] = useTransition();

  const [serviceId, setServiceId] = useState("");
  const [staffList, setStaffList] = useState<BookableStaff[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(minDate);
  const [month, setMonth] = useState(() => startOfMonth(minDate));
  const [tz, setTz] = useState("UTC");
  // Huecos del mes cargado, por día local. Elegir día no toca el servidor.
  const [porDia, setPorDia] = useState<Map<string, Slot[]>>(new Map());
  const [mesCargado, setMesCargado] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  const slots = porDia.get(date) ?? [];
  const slotsLoaded = mesCargado === month;

  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  // El servidor dijo que no queda estación (pudo llenarse después de cargar
  // los horarios): el siguiente envío ya va confirmado.
  const [stationsWarning, setStationsWarning] = useState(false);

  /**
   * Al salir del teléfono se mira si ese número ya es de un cliente del
   * negocio y se completan sus datos. Sólo aquí, no en la página pública:
   * allí permitiría averiguar quién es cliente probando números.
   */
  function recognise() {
    const phone = form.phone.trim();
    if (phone === "") return;

    // Se valida el largo en el acto: decirlo al pulsar "Crear cita" es tarde.
    const malTelefono = phoneLengthError(phone, dialCode);
    if (malTelefono) {
      setErrors((e) => ({ ...e, phone: [malTelefono] }));
      setKnown(null);
      return;
    }
    setErrors((e) => ({ ...e, phone: undefined }));
    startLookup(async () => {
      const res = await lookupCustomerByPhone(phone);
      if (!res.found) {
        setKnown(null);
        return;
      }
      setKnown(res.name);
      setForm((f) => ({
        ...f,
        name: f.name.trim() === "" ? res.name.toUpperCase() : f.name,
        email: f.email.trim() === "" ? (res.email ?? "") : f.email,
      }));
    });
  }

  const service = services.find((s) => s.id === serviceId) ?? null;

  function pickService(id: string) {
    setServiceId(id);
    setStaffId(null);
    setSlot(null);
    setPorDia(new Map());
    setMesCargado(null);
    startTransition(async () => {
      const list = id ? await getBookableStaff(slug, id) : [];
      // El servidor vuelve a comprobarlo al crear la cita; esto sólo evita
      // ofrecer lo que luego se rechazaría.
      const mine = onlyStaffId ? list.filter((m) => m.id === onlyStaffId) : list;
      setStaffList(mine);
      if (onlyStaffId && mine.length > 0) {
        setStaffId(onlyStaffId);
        loadMonth(month, onlyStaffId, id);
      }
    });
  }

  /** Un viaje por mes, no uno por día: cada consulta cuesta ~1 s de red. */
  function loadMonth(mes: string, forStaff: string | null, svc = serviceId) {
    if (!svc) return;
    setMesCargado(null);
    setSlot(null);
    startTransition(async () => {
      const ultimo = addDays(addMonths(mes, 1), -1);
      const res = await fetchPanelSlots(svc, forStaff, mes, ultimo);
      if (!res.ok) {
        setPorDia(new Map());
        setMesCargado(mes);
        return;
      }
      setTz(res.timeZone);

      const mapa = new Map<string, Slot[]>();
      const porHora = new Map<string, Slot>();
      for (const s of res.slots) {
        // Los ocupados son para la página pública; aquí sólo se elige libre.
        if (s.taken) continue;
        // Una entrada por hora. Con estaciones el resultado es el mismo para
        // todos los profesionales, así que basta con quedarse con el primero.
        if (porHora.has(s.start)) continue;
        porHora.set(s.start, {
          start: s.start,
          staffMemberId: s.staffMemberId,
          stationsFull: s.stationsFull,
        });
      }
      for (const s of porHora.values()) {
        const dia = zonedDateAndMinutes(s.start, res.timeZone).date;
        mapa.set(dia, [...(mapa.get(dia) ?? []), s]);
      }
      setPorDia(mapa);
      setMesCargado(mes);
      if (!mapa.has(date)) {
        const primero = [...mapa.keys()].sort()[0];
        if (primero) setDate(primero);
      }
    });
  }

  function pickStaff(id: string | null) {
    setStaffId(id);
    loadMonth(month, id);
  }

  /** Instantáneo: los huecos del mes ya están en memoria. */
  function changeDate(d: string) {
    if (d < minDate || d > maxDate) return;
    setDate(d);
    setSlot(null);
    setStationsWarning(false);
  }

  const forceStations = Boolean(slot?.stationsFull) || stationsWarning;

  function submit() {
    if (!service || !slot) return;
    setErrors({});
    setFormError(null);

    const malTelefono = phoneLengthError(form.phone, dialCode);
    if (malTelefono) {
      setErrors({ phone: [malTelefono] });
      return;
    }
    startTransition(async () => {
      const res = await createAppointmentFromPanel({
        serviceId: service.id,
        staffMemberId: slot.staffMemberId,
        startISO: slot.start,
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        overrideStations: forceStations,
      });
      if (res.ok) {
        toast.success("Cita creada.");
        router.push(`${agendaPath}?d=${res.date}&v=dia`);
      } else if (res.code === "stations_full") {
        setStationsWarning(true);
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
              {onlyStaffId ? null : (
                <Chip active={staffId === null && slotsLoaded} onClick={() => pickStaff(null)}>
                  Cualquiera
                </Chip>
              )}
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
                {onlyStaffId
                  ? "No tienes asignado este servicio."
                  : "Ningún profesional realiza este servicio."}
              </p>
            ) : null}
          </Section>
        ) : null}

        {/* Día y hora */}
        {serviceId && slotsLoaded ? (
          <Section title="3 · Día y hora">
            {/* En el panel hay sitio de sobra: el calendario a la izquierda y
                las horas al lado, en vez de una rejilla enorme apilada. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
              <MonthCalendar
                month={month}
                onMonth={(m) => {
                  setMonth(m);
                  loadMonth(m, staffId);
                }}
                available={slotsLoaded ? new Set(porDia.keys()) : null}
                selected={date}
                minDate={minDate}
                maxDate={maxDate}
                onPick={changeDate}
              />

              <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                {pending ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Buscando horarios…
                  </p>
                ) : slots.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay horarios disponibles ese día. Prueba con otra fecha.
                  </p>
                ) : (
                  <>
                    <SlotGrid
                      slots={slots.map((s) => s.start)}
                      warn={new Set(slots.filter((s) => s.stationsFull).map((s) => s.start))}
                      label={timeFmt}
                      selected={slot?.start ?? null}
                      onPick={(start) => {
                        const elegido = slots.find((s) => s.start === start);
                        if (elegido) setSlot(elegido);
                        setStationsWarning(false);
                      }}
                    />
                    {slots.some((s) => s.stationsFull) ? (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2.5 rounded-sm border border-amber-400/70 bg-amber-500/20" />
                        Sin estación libre: puedes agendarla igualmente.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
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
            {/* El teléfono va primero: es lo que identifica al cliente, así
                que al escribirlo se rellena solo el resto. */}
            <Field
              id="phone"
              label="Teléfono"
              type="tel"
              value={form.phone}
              onChange={(v) => {
                setForm({ ...form, phone: v });
                setErrors((e) => ({ ...e, phone: undefined }));
                setKnown(null);
              }}
              onBlur={recognise}
              hint={
                known
                  ? `Cliente ya registrado: ${known}`
                  : digitos
                    ? `${digitos} dígitos.`
                    : undefined
              }
              errors={errors.phone}
            />
            <Field
              id="name"
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v.toUpperCase() })}
              errors={errors.name}
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

            {forceStations && slot ? (
              <p className="rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                A esa hora todas las estaciones de trabajo están ocupadas. Si
                la agendas, habrá más citas que estaciones.
              </p>
            ) : null}

            <Button
              type="button"
              onClick={submit}
              disabled={pending || !slot}
              className={cn(
                "w-full",
                forceStations && slot && "bg-amber-600 text-white hover:bg-amber-600/90",
              )}
            >
              {pending
                ? "Creando…"
                : forceStations && slot
                  ? "Agendar de todos modos"
                  : "Crear cita"}
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
  onBlur,
  errors,
  hint,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  errors?: string[];
  hint?: string;
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
        onBlur={onBlur}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  );
}
