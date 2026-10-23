/**
 * Estaciones de trabajo: con N sillones no hay más de N citas a la vez,
 * aunque sobren profesionales.
 *
 * Primero el cálculo de horarios (puro, sin red) y después la red de
 * seguridad en la base: el trigger que cuenta estaciones al guardar una
 * cita, incluso con dos reservas simultáneas al último hueco.
 */
import { createJiti } from "../node_modules/jiti/lib/jiti.mjs";

import {
  RUN, createUser, deleteBusiness, deleteUser, insert, login, ok, rest, rpc,
  section, summary, asUser,
} from "./lib.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const jiti = createJiti(import.meta.url, { alias: { "@": ROOT } });
const { computeAvailability, maxConcurrent } = await jiti.import(
  "../lib/availability/compute.ts",
);

// ── A. Cálculo ─────────────────────────────────────────────────────────────
section("A1. maxConcurrent");
const iv = (a, b) => ({ start: a, end: b });
ok(maxConcurrent([iv(0, 10), iv(0, 10)], 0, 10) === 2, "dos a la vez cuentan dos");
ok(maxConcurrent([iv(0, 5), iv(5, 10)], 0, 10) === 1,
  "dos seguidas que no se pisan cuentan una (no se suma por solapar con el hueco)");
ok(maxConcurrent([iv(0, 10)], 10, 20) === 0, "terminar justo cuando empieza no estorba");

const TZ = "UTC";
const DAY = "2030-01-15"; // martes
const base = {
  now: new Date("2030-01-01T00:00:00Z"),
  timeZone: TZ,
  service: { durationMinutes: 30, bufferMinutes: 15 },
  minBookingNoticeHours: 0,
  maxBookingDays: 60,
  slotIntervalMinutes: 15,
  dateFrom: DAY,
  dateTo: DAY,
  staffIds: ["s1", "s2", "s3"],
  rules: ["s1", "s2", "s3"].map((id) => ({
    staffMemberId: id, dayOfWeek: 2, start: "10:00", end: "12:00",
  })),
  exceptions: [],
  busy: [
    { staffMemberId: "s1", startAt: `${DAY}T10:00:00Z`, endAt: `${DAY}T10:30:00Z` },
    { staffMemberId: "s2", startAt: `${DAY}T10:00:00Z`, endAt: `${DAY}T10:30:00Z` },
  ],
};
// Con la limpieza ya sumada, como las entrega getSlots.
const stationBusy = [
  { startAt: `${DAY}T10:00:00Z`, endAt: `${DAY}T10:45:00Z` },
  { startAt: `${DAY}T10:00:00Z`, endAt: `${DAY}T10:45:00Z` },
];
const at = (slots, hhmm) => slots.filter((s) => s.start === `${DAY}T${hhmm}:00.000Z`);

section("A2. sin límite: como siempre");
const libre = computeAvailability({ ...base });
ok(at(libre, "10:00").length === 1 && at(libre, "10:00")[0].staffMemberId === "s3",
  "a las 10:00 queda el tercer profesional");

section("A3. con 2 estaciones");
const dos = computeAvailability({ ...base, stations: { capacity: 2, busy: stationBusy } });
ok(at(dos, "10:00").length === 0, "a las 10:00 ya no se ofrece, aunque s3 esté libre");
ok(at(dos, "10:30").length === 0, "a las 10:30 tampoco: siguen limpiando hasta las 10:45");
ok(at(dos, "10:45").length > 0, "a las 10:45 sí");
const tres = computeAvailability({ ...base, stations: { capacity: 3, busy: stationBusy } });
ok(at(tres, "10:00").length === 1, "con 3 estaciones vuelve a entrar s3");

section("A4. cómo se ven los horarios sin estación");
const publica = computeAvailability({
  ...base, includeTaken: true, stations: { capacity: 2, busy: stationBusy },
});
ok(at(publica, "10:00").every((s) => s.taken), "en la página pública salen tachados");
const admin = computeAvailability({
  ...base, markStationsFull: true, stations: { capacity: 2, busy: stationBusy },
});
const a10 = at(admin, "10:00");
ok(a10.length === 1 && a10[0].stationsFull === true && !a10[0].taken,
  "al admin le llegan elegibles, marcados sin estación");

// ── B. Base de datos ───────────────────────────────────────────────────────
const SLUG = `qa-estaciones-${RUN}`;
const users = [];
section("setup");
const biz = await insert("businesses", {
  name: "QA Estaciones", slug: SLUG, status: "trial", timezone: "America/Mexico_City",
  station_count: 2,
});
const conSillon = await insert("services", {
  business_id: biz.id, name: "Pedicure", duration_minutes: 30, price: 50, buffer_minutes: 15,
});
const sinSillon = await insert("services", {
  business_id: biz.id, name: "Valoración", duration_minutes: 30, price: 0, uses_station: false,
});
const emailStaff = `qa-est-${RUN}@example.com`;
const uStaff = await createUser(emailStaff);
users.push(uStaff.uid);
await rest(`profiles?id=eq.${uStaff.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: biz.id, role: "staff" }),
});
const sm = [];
for (const [i, name] of ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis"].entries()) {
  sm.push(await insert("staff_members", {
    business_id: biz.id, display_name: name, ...(i === 2 ? { profile_id: uStaff.uid } : {}),
  }));
}
const cli = (await rpc("upsert_customer", {
  p_business_id: biz.id, p_name: "Cliente QA", p_phone: "3311112222",
})).body;

const D = "2030-01-15";
const nueva = (staff, hhmm, svc = conSillon, extra = {}) =>
  rest("appointments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_id: biz.id, service_id: svc.id, staff_member_id: staff.id,
      customer_id: cli, status: "confirmed",
      start_at: `${D}T${hhmm}:00Z`,
      end_at: new Date(new Date(`${D}T${hhmm}:00Z`).getTime() + svc.duration_minutes * 60_000).toISOString(),
      ...extra,
    }),
  });
const err = async (r) => (r.ok ? null : (await r.json()).code);

try {
  section("B1. el trigger cuenta estaciones");
  const c1 = await nueva(sm[0], "16:00");
  const c2 = await nueva(sm[1], "16:00");
  ok(c1.ok && c2.ok, "dos citas a las 16:00 con 2 estaciones");
  const [cita1] = await c1.json();
  const tercera = await nueva(sm[2], "16:00");
  ok(await err(tercera) === "RP409", "la tercera a la misma hora se rechaza (RP409)");
  ok(await err(await nueva(sm[2], "16:30")) === "RP409",
    "a las 16:30 también: las otras dos siguen limpiando");
  ok((await nueva(sm[2], "16:45")).ok, "a las 16:45 sí entra");
  ok((await nueva(sm[3], "16:00", sinSillon)).ok, "un servicio sin estación no cuenta");

  section("B2. forzar: sólo el servidor");
  // Cada profesional en su propio hueco: si no, la que salta es la regla de
  // no empalmar citas del mismo profesional (23P01), no la de estaciones.
  const forzada = await nueva(sm[4], "16:15", conSillon, { station_override: true });
  const [citaForzada] = forzada.ok ? await forzada.json() : [{}];
  ok(forzada.ok, `el servidor (admin que confirmó) puede agendar por encima del límite${
    forzada.ok ? "" : ` (${JSON.stringify(citaForzada)})`}`);
  const yo = asUser((await login(emailStaff)).access_token);
  const [mia] = await (await rest(`appointments?select=id&staff_member_id=eq.${sm[2].id}`)).json();
  const truco = await yo(`appointments?id=eq.${mia.id}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ station_override: true }),
  });
  ok(truco.status === 403, `un profesional no puede marcar su cita como forzada (${truco.status})`);
  const nota = await rest(`appointments?id=eq.${citaForzada.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ notes: "editada" }),
  });
  ok(nota.ok, "editar la nota de una cita en un horario lleno no falla");

  section("B3. reactivar una cancelada");
  await rest(`appointments?id=eq.${cita1.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "cancelled" }),
  });
  ok(await err(await nueva(sm[5], "16:00")) === "RP409",
    "con la cita forzada de las 16:15 el hueco sigue lleno");
  await rest(`appointments?id=eq.${citaForzada.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "cancelled" }),
  });
  const ocupa = await nueva(sm[5], "16:00");
  ok(ocupa.ok, "al cancelar las dos, el hueco se libera para otra");
  const revivir = await rest(`appointments?id=eq.${cita1.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "confirmed" }),
  });
  ok(await err(revivir) === "RP409", "y la cancelada ya no se puede reactivar ahí");

  section("B4. tres reservas a la vez por los dos últimos huecos");
  const carrera = await Promise.all([
    nueva(sm[0], "18:00"), nueva(sm[1], "18:00"), nueva(sm[2], "18:00"),
  ]);
  ok(carrera.filter((r) => r.ok).length === 2, "entran exactamente dos");
  const enUso = await rpc("stations_in_use", {
    p_business_id: biz.id, p_start: `${D}T18:00:00Z`, p_end: `${D}T18:30:00Z`,
  });
  ok(enUso.body === 2, `y nunca hay más de 2 en uso (${enUso.body})`);

  section("B5. sin límite");
  await rest(`businesses?id=eq.${biz.id}`, {
    method: "PATCH", body: JSON.stringify({ station_count: null }),
  });
  ok((await nueva(sm[3], "18:00")).ok, "con el campo vacío entra una tercera a la vez");
} finally {
  section("cleanup");
  await deleteBusiness(SLUG);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
