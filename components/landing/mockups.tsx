/**
 * Maquetas ilustrativas de la landing, hechas en HTML (no capturas): se ven
 * nítidas a cualquier tamaño, respetan el tema y no pesan. Nombres y datos
 * son de ejemplo.
 */
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  NotebookPen,
  QrCode,
  Repeat,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { InstagramIcon, WhatsAppIcon } from "@/components/landing/brand-icons";

const STAFF = {
  ana: { name: "Ana", color: "oklch(0.86 0.07 274)", ink: "oklch(0.38 0.14 274)" },
  leo: { name: "Leo", color: "oklch(0.88 0.07 200)", ink: "oklch(0.38 0.09 200)" },
  sofi: { name: "Sofi", color: "oklch(0.89 0.07 340)", ink: "oklch(0.42 0.13 340)" },
};

/* ───────────────────────────── piezas comunes ───────────────────────────── */

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[2.4rem] border-[7px] border-[oklch(0.2_0.02_272)] bg-card shadow-2xl shadow-primary/20",
        className,
      )}
    >
      <div className="absolute top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[oklch(0.2_0.02_272)]" />
      <div className="h-full overflow-hidden rounded-[1.9rem]">{children}</div>
    </div>
  );
}

function WaBubble({
  name,
  time,
  text,
  className,
}: {
  name: string;
  time: string;
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border border-[#25D366]/25 bg-card p-3.5 shadow-lg shadow-black/5",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon className="size-5" />
      </span>
      <div className="min-w-0 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold">ReservaPrimero · {name}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/* ────────────────────────────────── hero ────────────────────────────────── */

const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const HERO_BLOCKS: { day: number; top: number; h: number; s: keyof typeof STAFF; who: string }[] = [
  { day: 0, top: 6, h: 22, s: "ana", who: "Mariana · Corte" },
  { day: 0, top: 58, h: 18, s: "leo", who: "Diego · Barba" },
  { day: 1, top: 18, h: 30, s: "sofi", who: "Paula · Uñas" },
  { day: 1, top: 70, h: 16, s: "ana", who: "Lucía · Peinado" },
  { day: 2, top: 4, h: 16, s: "leo", who: "Andrés · Corte" },
  { day: 2, top: 36, h: 26, s: "ana", who: "Camila · Tinte" },
  { day: 3, top: 24, h: 20, s: "sofi", who: "Valeria · Gel" },
  { day: 3, top: 62, h: 22, s: "leo", who: "Jorge · Corte" },
  { day: 4, top: 10, h: 26, s: "ana", who: "Daniela · Corte" },
  { day: 4, top: 50, h: 18, s: "sofi", who: "Renata · Pestañas" },
];

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] pt-10 pb-6">
      {/* Calendario semanal */}
      <div className="mr-24 rounded-2xl border border-border bg-card p-3 shadow-xl shadow-primary/10 sm:mr-32">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex gap-1 text-[10px] font-medium">
            <span className="rounded-md px-2 py-1 text-muted-foreground">Día</span>
            <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">Semana</span>
            <span className="rounded-md px-2 py-1 text-muted-foreground">Mes</span>
          </div>
          <div className="flex -space-x-1.5">
            {Object.values(STAFF).map((s) => (
              <span
                key={s.name}
                className="flex size-5 items-center justify-center rounded-full border-2 border-card text-[8px] font-bold"
                style={{ background: s.color, color: s.ink }}
              >
                {s.name[0]}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {WEEK.map((d, i) => (
            <div key={d}>
              <p className="pb-1 text-center text-[10px] font-medium text-muted-foreground">{d}</p>
              <div className="relative h-52 rounded-md bg-muted/60">
                {HERO_BLOCKS.filter((b) => b.day === i).map((b) => (
                  <div
                    key={b.who}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md border-l-[3px] px-1 py-0.5"
                    style={{
                      top: `${b.top}%`,
                      height: `${b.h}%`,
                      background: STAFF[b.s].color,
                      borderColor: STAFF[b.s].ink,
                      color: STAFF[b.s].ink,
                    }}
                  >
                    <p className="truncate text-[8px] leading-tight font-semibold">{b.who}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teléfono con la página de reservas */}
      <PhoneFrame className="absolute top-0 right-0 h-[330px] w-[168px] sm:w-[180px]">
        <div className="flex h-full flex-col bg-card px-3 pt-8 text-left">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              BJ
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">Barbería Juanito</p>
              <p className="text-[9px] text-muted-foreground">Corte clásico · 45 min</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-semibold">Jueves 16</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {["10:00", "10:45", "11:30", "12:15", "16:00", "16:45"].map((t, i) => (
              <span
                key={t}
                className={cn(
                  "rounded-md border py-1 text-center text-[10px]",
                  i === 2
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-auto mb-4 rounded-lg bg-primary py-2 text-center text-[10px] font-semibold text-primary-foreground">
            Confirmar reserva
          </div>
        </div>
      </PhoneFrame>

      {/* Burbuja de WhatsApp */}
      <div className="rp-float absolute -bottom-2 left-2 w-[270px] sm:left-8">
        <span className="absolute -top-3 left-6 z-10 rounded-full bg-[oklch(0.2_0.02_272)] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
          Recordatorio
        </span>
        <div className="flex gap-3 rounded-2xl bg-[#25D366] p-3.5 text-white shadow-xl shadow-[#25D366]/30">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <WhatsAppIcon className="size-5" />
          </span>
          <p className="text-left text-[13px] leading-snug">
            <span className="block text-[11px] font-semibold opacity-90">WhatsApp</span>
            Hola Mariana 👋 te recordamos tu cita mañana a las 11:30 en Barbería Juanito.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── un enlace, reservas de todas partes ──────────── */

const NEW_BOOKINGS = [
  ["Sofía Martínez", "10:30"],
  ["Lucas Pérez", "15:00"],
  ["Valentina López", "09:15"],
  ["Martín Díaz", "17:45"],
];

export function ChannelsVisual() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="flex justify-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white shadow-lg">
          <InstagramIcon className="size-8" />
        </span>
        <span className="flex size-16 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg">
          <WhatsAppIcon className="size-8" />
        </span>
        <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-lg">
          <QrCode className="size-8" />
        </span>
      </div>
      {/* Pila de avisos que rota sola */}
      <div className="relative mt-8 h-24">
        {NEW_BOOKINGS.map(([n, t], i) => (
          <div
            key={n}
            className="rp-stack absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-lg shadow-black/5"
            style={{ animationDelay: `${i * 2}s` }}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CalendarCheck className="size-5" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold">Nueva reserva</p>
              <p className="text-sm text-muted-foreground">
                {n} · {t}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RemindersVisual() {
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <WaBubble
        name="Sofía"
        time="hace 2 min"
        text="Hola Sofía 👋 te recordamos tu cita mañana a las 10:30 en Spa Norte. Para cancelar o reagendar: reservaprimero.com/reservas/…"
      />
      <WaBubble
        name="Lucas"
        time="hace 1 h"
        text="Hola Lucas 👋 te recordamos tu cita hoy a las 15:00 en Barbería Juanito."
        className="ml-6"
      />
      <div className="ml-12 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-lg shadow-black/5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <BellRing className="size-5" />
        </span>
        <p className="text-left text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">24 h y 2 h antes</span> · por
          WhatsApp y email
        </p>
      </div>
    </div>
  );
}

export function ManageVisual() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-card p-5 text-left shadow-xl shadow-primary/10">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        Tu reserva
      </p>
      <p className="mt-2 font-heading text-xl font-semibold">Corte clásico</p>
      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" /> Jueves 16, 11:30
        </p>
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-primary" /> 45 min · con Leo
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Barbería Juanito
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <span className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground">
          <Repeat className="size-4" /> Reagendar
        </span>
        <span className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium">
          <X className="size-4" /> Cancelar
        </span>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Sin cuenta ni contraseña: el enlace llega con la confirmación.
      </p>
    </div>
  );
}

/* ─────────────────────── carrusel de pantallas de teléfono ─────────────── */

export function ConfirmedScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-card px-6 text-center">
      <span className="rp-pop flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <Check className="size-8" strokeWidth={3} />
      </span>
      <p className="font-heading text-xl font-semibold">¡Reserva confirmada!</p>
      <p className="text-xs text-muted-foreground">Jueves 16 · 11:30 · Corte clásico</p>
    </div>
  );
}

export function InstagramScreen({ host }: { host: string }) {
  return (
    <div className="h-full bg-white px-3 pt-9 text-left text-[oklch(0.2_0_0)]">
      <p className="text-xs font-semibold">studio.luna</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]">
          <span className="flex size-full items-center justify-center rounded-full bg-white text-xs font-bold">
            LUNA
          </span>
        </span>
        <div className="grid flex-1 grid-cols-3 text-center text-[8px] leading-tight">
          {[
            ["86", "posts"],
            ["3,1 mil", "seguid."],
            ["210", "siguiendo"],
          ].map(([a, b]) => (
            <span key={b}>
              <b className="block text-xs">{a}</b>
              {b}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold">Studio Luna</p>
      <p className="text-[10px] text-neutral-500">Uñas y pestañas · Guadalajara</p>
      <p className="mt-1 text-[10px] font-medium text-[#00376b]">🔗 {host}/studio-luna</p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <span className="rounded-md bg-[#0095f6] py-1 text-center text-[10px] font-semibold text-white">
          Seguir
        </span>
        <span className="rounded-md bg-neutral-100 py-1 text-center text-[10px] font-semibold">
          Reservar
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-0.5">
        {[300, 340, 20, 274, 200, 320].map((h) => (
          <span
            key={h}
            className="aspect-square"
            style={{ background: `linear-gradient(135deg, oklch(0.85 0.08 ${h}), oklch(0.7 0.12 ${h + 30}))` }}
          />
        ))}
      </div>
    </div>
  );
}

export function QrScreen() {
  // Patrón decorativo con forma de QR (no es un código escaneable).
  const cells = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return finder || (x * 7 + y * 13 + x * y) % 5 < 2;
  });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-card px-6 text-center">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-md">
        <div className="grid grid-cols-11 gap-[2px]">
          {cells.map((on, i) => (
            <span key={i} className={cn("size-2.5 rounded-[1px]", on ? "bg-[oklch(0.2_0.02_272)]" : "bg-transparent")} />
          ))}
        </div>
      </div>
      <p className="font-heading text-lg font-semibold">Escanea y reserva</p>
      <p className="text-xs text-muted-foreground">Imprímelo y ponlo en tu mostrador</p>
    </div>
  );
}

export function LockScreen() {
  return (
    <div className="flex h-full flex-col items-center bg-gradient-to-b from-[oklch(0.45_0.12_274)] to-[oklch(0.3_0.08_290)] px-3 pt-12 text-white">
      <p className="text-xs opacity-80">jueves 16 de octubre</p>
      <p className="font-heading text-5xl font-semibold">9:41</p>
      <div className="mt-8 w-full rounded-2xl bg-white/90 p-3 text-left text-[oklch(0.2_0_0)] shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-[#25D366] text-white">
            <WhatsAppIcon className="size-3.5" />
          </span>
          <span className="text-[11px] font-semibold">WhatsApp</span>
          <span className="ml-auto text-[10px] text-neutral-500">ahora</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-snug">
          Hola Sofía 👋 te recordamos tu cita hoy a las 11:30. ¡Te esperamos!
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── "mucho más que una agenda" ───────────────────── */

export function TeamCalendarVisual() {
  const rows = ["09:00", "10:00", "11:00", "12:00"];
  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-4 shadow-xl shadow-primary/10">
      <div className="grid grid-cols-[3rem_repeat(3,1fr)] gap-1.5 text-[11px]">
        <span />
        {Object.values(STAFF).map((s) => (
          <span key={s.name} className="flex items-center justify-center gap-1.5 pb-1 font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: s.ink }} />
            {s.name}
          </span>
        ))}
        {rows.map((r, ri) => (
          <div key={r} className="contents">
            <span className="pt-1 text-muted-foreground">{r}</span>
            {Object.values(STAFF).map((s, si) =>
              (ri + si) % 3 === 2 ? (
                <span key={s.name} className="h-11 rounded-lg border border-dashed border-border" />
              ) : (
                <span
                  key={s.name}
                  className="h-11 rounded-lg border-l-[3px] px-1.5 py-1 font-medium"
                  style={{ background: s.color, borderColor: s.ink, color: s.ink }}
                >
                  {["Corte", "Tinte", "Uñas", "Barba"][(ri + si) % 4]}
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerVisual() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-left shadow-xl shadow-primary/10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">
          MR
        </span>
        <div>
          <p className="font-semibold">Mariana Ruiz</p>
          <p className="text-sm text-muted-foreground">+52 33 1234 5678 · 12 citas</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-muted/60 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <NotebookPen className="size-3.5" /> Historia clínica
        </p>
        <p className="mt-1 text-sm">Piel sensible: usar tinte sin amoniaco. Prefiere citas por la mañana.</p>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {[
          ["Tinte + corte", "12 sep", "Asistió"],
          ["Corte", "8 ago", "Asistió"],
        ].map(([s, d, st]) => (
          <div key={d} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <span>{s}</span>
            <span className="text-muted-foreground">{d}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {st}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsVisual() {
  const bars = [38, 52, 45, 70, 62, 88, 76];
  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-left shadow-xl shadow-primary/10">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Citas", "184"],
          ["Asistencia", "94%"],
          ["Facturación", "$41.2k"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="font-heading text-xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-32 items-end gap-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-lg bg-gradient-to-t from-primary/70 to-primary"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DigestVisual() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-left shadow-xl shadow-primary/10">
      <p className="text-xs text-muted-foreground">Para: leo@barberiajuanito.mx · 7:00</p>
      <p className="mt-1 font-semibold">Tu agenda de hoy: 5 citas</p>
      <div className="mt-3 space-y-2 text-sm">
        {[
          ["10:00", "Diego", "Barba"],
          ["11:30", "Mariana", "Corte clásico"],
          ["13:00", "Andrés", "Corte"],
        ].map(([t, n, s]) => (
          <div key={t} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
            <span className="font-semibold text-primary">{t}</span>
            <span>{n}</span>
            <span className="ml-auto text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-accent px-3 py-2 text-sm text-accent-foreground">
        <ChevronLeft className="size-4 rotate-180" /> Nueva cita: Lucía, 16:00
      </div>
    </div>
  );
}
