/**
 * Avisos al equipo.
 *
 * Lo que se protege: que el resumen diario no se mande dos veces aunque el
 * cron corra cada media hora, que respete la hora local del negocio, y que el
 * aviso de cita nueva quede registrado con destinatario `staff` — que es lo
 * que impide duplicarlo.
 *
 * Necesita el servidor de desarrollo levantado (usa la ruta del cron).
 */
import {
  RUN, createUser, deleteBusiness, deleteUser, insert, ok, rest, rpc, section,
  summary,
} from "./lib.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const SLUG = `qa-avisos-${RUN}`;
const users = [];
const TZ = "America/Mexico_City";

/** Hora local del negocio ahora mismo. */
function horaLocal(tz) {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hour: "2-digit", hour12: false,
    }).format(new Date()),
  ) % 24;
}

/** Fecha local (YYYY-MM-DD) del negocio. */
function fechaLocal(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const cron = () => fetch(`${BASE}/api/cron/reminders`).then((r) => r.json());

const digests = async (bizId) =>
  (await (await rest(`daily_digest_log?select=staff_member_id,local_date&business_id=eq.${bizId}`)).json());

section("setup");
const biz = await insert("businesses", {
  name: "QA Avisos", slug: SLUG, status: "trial", timezone: TZ,
  staff_digest_hour: horaLocal(TZ),
});
ok(biz.notify_staff_on_booking === true, "los avisos al equipo vienen activados");
ok(biz.staff_digest_hour === horaLocal(TZ), "la hora del resumen se guarda");

// El resumen del negocio va al primer perfil `business_admin` del negocio.
const owner = await createUser(`qa-owner-${RUN}@example.com`);
users.push(owner.uid);
await rest(`profiles?id=eq.${owner.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: biz.id }),
});

const pro = await mkStaff("Profesional QA", `qa-pro-${RUN}@example.com`);
const svc = await insert("services", {
  business_id: biz.id, name: "Sesión", duration_minutes: 30, price: 50,
});
await insert("staff_services", { staff_member_id: pro.id, service_id: svc.id });

const cliente = (await rpc("upsert_customer", {
  p_business_id: biz.id, p_name: "Cliente QA", p_phone: "3312345678",
})).body;

// Una cita hoy, a mediodía local.
const hoy = fechaLocal(TZ);
const inicio = new Date(`${hoy}T18:00:00Z`); // ~12:00 en México
const cita = await insert("appointments", {
  business_id: biz.id, service_id: svc.id, staff_member_id: pro.id,
  customer_id: cliente, status: "confirmed",
  start_at: inicio.toISOString(),
  end_at: new Date(inicio.getTime() + 1800_000).toISOString(),
});
ok(!!cita.id, "negocio, profesional, servicio y una cita de hoy");

async function mkStaff(nombre, email) {
  const u = await createUser(email);
  users.push(u.uid);
  await rest(`profiles?id=eq.${u.uid}`, {
    method: "PATCH",
    body: JSON.stringify({ business_id: biz.id, role: "staff" }),
  });
  return insert("staff_members", {
    business_id: biz.id, display_name: nombre, profile_id: u.uid,
    invited_email: email,
  });
}

try {
  section("1. el resumen sale una sola vez al día");
  const r1 = await cron();
  ok(r1.ok === true, "el cron responde");
  const tras1 = await digests(biz.id);
  ok(tras1.length === 2, `se registran los dos resúmenes: profesional y dueño (${tras1.length})`);
  ok(
    tras1.every((d) => d.local_date === hoy),
    "quedan fechados con la fecha local del negocio",
  );

  await cron();
  await cron();
  const tras3 = await digests(biz.id);
  ok(tras3.length === 2, `tres pasadas del cron siguen dejando dos registros (${tras3.length})`);

  section("2. fuera de la hora configurada no se manda nada");
  await rest(`daily_digest_log?business_id=eq.${biz.id}`, { method: "DELETE" });
  const otraHora = (horaLocal(TZ) + 5) % 24;
  await rest(`businesses?id=eq.${biz.id}`, {
    method: "PATCH", body: JSON.stringify({ staff_digest_hour: otraHora }),
  });
  await cron();
  ok((await digests(biz.id)).length === 0, "con la hora cambiada no sale el resumen");

  section("3. el aviso de cita nueva queda registrado como `staff`");
  await rest(`notifications_log?appointment_id=eq.${cita.id}`, { method: "DELETE" });
  // El dispatch corre dentro de la app; se comprueba que el log admite el
  // destinatario nuevo y que el índice único lo distingue del cliente.
  const a = await rest("notifications_log", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      appointment_id: cita.id, channel: "email", type: "confirmation",
      recipient: "staff", status: "sent", sent_at: new Date().toISOString(),
    }),
  });
  ok(a.status === 201, `admite recipient "staff" (${a.status})`);

  const b = await rest("notifications_log", {
    method: "POST",
    body: JSON.stringify({
      appointment_id: cita.id, channel: "email", type: "confirmation",
      recipient: "customer", status: "sent", sent_at: new Date().toISOString(),
    }),
  });
  ok(b.status === 201, `el aviso al cliente no choca con el del staff (${b.status})`);

  const c = await rest("notifications_log", {
    method: "POST",
    body: JSON.stringify({
      appointment_id: cita.id, channel: "email", type: "confirmation",
      recipient: "staff", status: "sent", sent_at: new Date().toISOString(),
    }),
  });
  ok(c.status >= 400, `pero el mismo aviso al staff no se duplica (${c.status})`);

  section("4. desactivar los avisos al equipo");
  await rest(`daily_digest_log?business_id=eq.${biz.id}`, { method: "DELETE" });
  await rest(`businesses?id=eq.${biz.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      staff_digest_hour: horaLocal(TZ), notify_staff_on_booking: false,
    }),
  });
  await cron();
  const soloDueno = await digests(biz.id);
  ok(
    soloDueno.length === 1 && soloDueno[0].staff_member_id === null,
    `desactivado, sólo se manda el resumen del dueño (${soloDueno.length})`,
  );
} finally {
  section("cleanup");
  await deleteBusiness(SLUG);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
