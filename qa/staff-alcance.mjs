/**
 * Alcance del panel de staff: un profesional sólo ve SUS citas.
 *
 * No basta con comprobar la RLS por la API: lo que importa es lo que acaba
 * pintado en la página, que es donde se filtra un dato de más.
 *
 * Necesita el servidor de desarrollo levantado.
 */
import {
  RUN, asUser, createUser, deleteBusiness, deleteUser, insert, login, ok, rest,
  rpc, section, sessionCookie, summary,
} from "./lib.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const SLUG = `qa-alcance-${RUN}`;
const users = [];
const TZ = "America/Mexico_City";

section("setup");
const biz = await insert("businesses", {
  name: "QA Alcance", slug: SLUG, status: "trial", timezone: TZ,
});

const mk = async (email, role) => {
  const u = await createUser(email);
  users.push(u.uid);
  await rest(`profiles?id=eq.${u.uid}`, {
    method: "PATCH",
    body: JSON.stringify({ business_id: biz.id, ...(role ? { role } : {}) }),
  });
  return u;
};

const uA = await mk(`qa-sa-a-${RUN}@example.com`, "staff");
const uB = await mk(`qa-sa-b-${RUN}@example.com`, "staff");

const svc = await insert("services", {
  business_id: biz.id, name: "Sesión QA", duration_minutes: 30, price: 50,
});
const smA = await insert("staff_members", {
  business_id: biz.id, display_name: "Ana Profesional", profile_id: uA.uid,
});
const smB = await insert("staff_members", {
  business_id: biz.id, display_name: "Borja Colega", profile_id: uB.uid,
});

const cliA = (await rpc("upsert_customer", {
  p_business_id: biz.id, p_name: "ClienteDeAna", p_phone: "3311110001",
})).body;
const cliB = (await rpc("upsert_customer", {
  p_business_id: biz.id, p_name: "ClienteDeBorja", p_phone: "3311110002",
})).body;

const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const cita = async (sm, cli, horaUTC) => {
  const start = new Date(`${hoy}T${horaUTC}:00:00Z`);
  return insert("appointments", {
    business_id: biz.id, service_id: svc.id, staff_member_id: sm.id,
    customer_id: cli, status: "confirmed",
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 1800_000).toISOString(),
  });
};
const citaA = await cita(smA, cliA, "16");
const citaB = await cita(smB, cliB, "18");
ok(!!citaA.id && !!citaB.id, "dos profesionales con una cita cada uno");

const sesionA = await login(`qa-sa-a-${RUN}@example.com`);
const a = asUser(sesionA.access_token);
const cookieA = sessionCookie(sesionA);

const page = async (path) => {
  const r = await fetch(BASE + path, {
    headers: { cookie: cookieA },
    redirect: "manual",
  });
  return { status: r.status, html: r.status === 200 ? await r.text() : "" };
};

try {
  section("1. la base sólo le sirve sus citas");
  const suyas = await (await a("appointments?select=id,staff_member_id")).json();
  ok(suyas.length === 1 && suyas[0].id === citaA.id,
    `sólo ve la suya por la API (${suyas.length})`);

  const upd = await a(`appointments?id=eq.${citaB.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  ok((await upd.json()).length === 0, "no puede cambiar el estado de la cita de su colega");

  const mia = await a(`appointments?id=eq.${citaA.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "no_show" }),
  });
  ok((await mia.json()).length === 1, "pero sí el de la suya");

  const alta = await a("appointments", {
    method: "POST",
    body: JSON.stringify({
      business_id: biz.id, service_id: svc.id, staff_member_id: smB.id,
      customer_id: cliA, status: "confirmed",
      start_at: new Date(`${hoy}T20:00:00Z`).toISOString(),
      end_at: new Date(`${hoy}T20:30:00Z`).toISOString(),
    }),
  });
  ok(alta.status >= 400, `no puede agendarle una cita a su colega (${alta.status})`);

  section("2. la página de staff tampoco");
  const p = await page(`/staff?d=${hoy}&v=dia`);
  ok(p.status === 200, `GET /staff = ${p.status}`);
  ok(p.html.includes("CLIENTEDEANA"), "aparece su propia cita");
  ok(!p.html.includes("CLIENTEDEBORJA"), "NO aparece el cliente de su colega");

  section("3. ni el nombre de sus colegas");
  ok(!p.html.includes("Borja Colega"),
    "el filtro de profesional no lista a los demás miembros del equipo");

  section("4. el panel de negocio le sigue vedado");
  const admin = await page(`/dashboard/calendario?d=${hoy}&v=dia`);
  ok(admin.status === 307, `/dashboard/calendario redirige (${admin.status})`);
  const clientes = await page("/dashboard/clientes");
  ok(clientes.status === 307, `/dashboard/clientes redirige (${clientes.status})`);
} finally {
  section("cleanup");
  await deleteBusiness(SLUG);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
