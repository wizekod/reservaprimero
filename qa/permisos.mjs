/**
 * Permisos del staff: lo que el admin le da a cada profesional.
 *
 * Se prueban en la base (la RLS, la vista de contactos y sus triggers), que
 * es el control real, y en la página, que es donde se ve si se escapa un
 * dato. Cada bloque cambia los permisos de Ana con service_role, como lo
 * haría su admin desde la ficha.
 *
 * Necesita el servidor de desarrollo levantado.
 */
import {
  RUN, asUser, createUser, deleteBusiness, deleteUser, insert, login, ok, rest,
  rpc, section, sessionCookie, summary,
} from "./lib.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const SLUG = `qa-permisos-${RUN}`;
const TZ = "America/Mexico_City";
const users = [];

section("setup");
const biz = await insert("businesses", {
  name: "QA Permisos", slug: SLUG, status: "trial", timezone: TZ,
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

const emailA = `qa-perm-a-${RUN}@example.com`;
await mk(`qa-perm-owner-${RUN}@example.com`, "business_admin");
const uA = await mk(emailA, "staff");
const uB = await mk(`qa-perm-b-${RUN}@example.com`, "staff");

const svc = await insert("services", {
  business_id: biz.id, name: "Sesión QA", duration_minutes: 30, price: 50,
});
const smA = await insert("staff_members", {
  business_id: biz.id, display_name: "Ana Permisos", profile_id: uA.uid,
});
const smB = await insert("staff_members", {
  business_id: biz.id, display_name: "Borja Colega", profile_id: uB.uid,
});

const cliente = async (name, phone) =>
  (await rpc("upsert_customer", { p_business_id: biz.id, p_name: name, p_phone: phone })).body;
const cliA = await cliente("ClienteDeAna", "3311110001");
const cliB = await cliente("ClienteDeBorja", "3311110002");
const cliSuelto = await cliente("ClienteSuelto", "3311110003");

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
ok(!!citaA.id && !!citaB.id, "Ana y Borja con una cita cada uno, y un cliente sin citas");

const sesionA = await login(emailA);
const a = asUser(sesionA.access_token);
const owner = asUser((await login(`qa-perm-owner-${RUN}@example.com`)).access_token);
const cookieA = sessionCookie(sesionA);

const json = async (res) => (res.ok ? res.json() : []);
const setPerms = (perms) =>
  rest(`staff_members?id=eq.${smA.id}`, { method: "PATCH", body: JSON.stringify(perms) });
// `select=id`: devolver la fila entera pediría también el teléfono, que con
// la migración 20261023120100 ya no se lee de la tabla (la app pide sólo id).
const patch = (who, path, body) =>
  who(`${path}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
const page = async (path) => {
  const r = await fetch(BASE + path, { headers: { cookie: cookieA }, redirect: "manual" });
  return { status: r.status, html: r.status === 200 ? await r.text() : "" };
};
const ids = (rows) => rows.map((r) => r.id).sort().join(",");

try {
  section("1. de entrada, como siempre: sólo lo suyo");
  const citas = await json(await a("appointments?select=id"));
  ok(ids(citas) === citaA.id, `sólo ve su cita (${citas.length})`);
  const contactos = await json(await a("customer_contacts?select=id,phone"));
  ok(ids(contactos) === cliA, "sólo ve a su cliente");
  ok(contactos[0]?.phone === "3311110001", "con su teléfono (permiso de contacto encendido)");
  const yo = await patch(a, `staff_members?id=eq.${smA.id}`, { can_view_all_appointments: true });
  ok((await json(yo)).length === 0, "no puede darse permisos a sí misma");
  const editar = await patch(a, `customers?id=eq.${cliA}`, { name: "HACKEADO" });
  ok((await json(editar)).length === 0, "no puede editar clientes");
  ok((await page("/staff/clientes")).status === 404, "/staff/clientes no existe para ella");
  ok((await page("/staff/nueva-reserva")).status === 404, "/staff/nueva-reserva tampoco");

  section("2. ver la agenda de todo el equipo");
  await setPerms({ can_view_all_appointments: true });
  const todas = await json(await a("appointments?select=id"));
  ok(todas.length === 2, `ve las dos citas (${todas.length})`);
  const nombres = await json(await a("customer_contacts?select=id,is_mine"));
  ok(nombres.length === 2, "y los nombres de ambos clientes (los necesita la agenda)");
  ok(nombres.find((c) => c.id === cliA)?.is_mine === true
    && nombres.find((c) => c.id === cliB)?.is_mine === false, "is_mine distingue los suyos");
  const ajena = await patch(a, `appointments?id=eq.${citaB.id}`, { status: "no_show" });
  ok((await json(ajena)).length === 0, "pero no puede cambiar la cita de Borja");
  const agenda = await page(`/staff?d=${hoy}&v=dia`);
  ok(agenda.html.includes("CLIENTEDEBORJA") && agenda.html.includes("Borja Colega"),
    "la página muestra la cita y el filtro de Borja");
  ok(agenda.html.includes("Agenda del equipo"), "y se titula «Agenda del equipo»");

  section("3. gestionar citas de otros");
  const sinVer = await rest(`staff_members?id=eq.${smB.id}`, {
    method: "PATCH", body: JSON.stringify({ can_manage_all_appointments: true }),
  });
  ok(sinVer.status >= 400, `la base no admite gestionar sin ver (${sinVer.status})`);
  await setPerms({ can_manage_all_appointments: true });
  const gestion = await patch(a, `appointments?id=eq.${citaB.id}`, { status: "no_show" });
  ok((await json(gestion)).length === 1, "ahora sí cambia la cita de Borja");

  section("4. clientes: sólo los suyos, con edición");
  await setPerms({ customers_scope: "own", can_edit_customers: true });
  const propio = await patch(a, `customers?id=eq.${cliA}`, { name: "CLIENTEDEANA EDITADO" });
  ok((await json(propio)).length === 1, "edita a su cliente");
  const deOtro = await patch(a, `customers?id=eq.${cliB}`, { name: "HACKEADO" });
  ok((await json(deOtro)).length === 0, "no edita al de Borja aunque vea su nombre en la agenda");
  const altaOwn = await a("customers", {
    method: "POST", body: JSON.stringify({ business_id: biz.id, name: "NUEVO OWN" }),
  });
  ok(altaOwn.status >= 400, `no da de alta fichas sueltas con «sólo los suyos» (${altaOwn.status})`);
  const lista = await page("/staff/clientes");
  ok(lista.status === 200, `/staff/clientes = ${lista.status}`);
  ok(lista.html.includes("CLIENTEDEANA EDITADO") && !lista.html.includes("CLIENTEDEBORJA"),
    "la lista sólo trae a los suyos");
  ok((await page(`/staff/clientes/${cliB}`)).status === 404, "y la ficha del de Borja da 404");

  section("5. clientes: todos");
  await setPerms({ customers_scope: "all" });
  const todos = await json(await a("customer_contacts?select=id"));
  ok(todos.length === 3, `ve también al cliente sin citas (${todos.length})`);
  const alta = await a("customers?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ business_id: biz.id, name: "NUEVO DESDE STAFF" }),
  });
  ok(alta.status === 201, `y puede dar de alta (${alta.status})`);
  const borrar = await a(`customers?id=eq.${cliSuelto}`, {
    method: "DELETE", headers: { Prefer: "return=representation" },
  });
  ok((await json(borrar)).length === 0, "pero nunca borrar");

  section("6. sin permiso de contacto");
  await setPerms({ can_see_customer_contact: false });
  const oculto = await json(await a(`customer_contacts?select=phone,phone_key,email,phone_last4&id=eq.${cliA}`));
  ok(oculto[0]?.phone === null && oculto[0]?.phone_key === null && oculto[0]?.email === null,
    "la vista le entrega teléfono, clave y correo en null");
  ok(oculto[0]?.phone_last4 === "0001", "salvo los 4 últimos dígitos");
  const cambiaTel = await patch(a, `customers?id=eq.${cliA}`, { phone: "3399999999" });
  ok(cambiaTel.status >= 400, `no puede cambiar (ni vaciar) el teléfono (${cambiaTel.status})`);
  const soloNombre = await patch(a, `customers?id=eq.${cliA}`, { name: "CLIENTEDEANA" });
  ok((await json(soloNombre)).length === 1, "el nombre sí");
  const agendaOculta = await page(`/staff?d=${hoy}&v=dia`);
  ok(!agendaOculta.html.includes("3311110001") && !agendaOculta.html.includes("3311110002"),
    "la agenda no lleva ningún teléfono completo");
  ok(agendaOculta.html.includes("•••• 0001"), "lleva el enmascarado");
  const fichaOculta = await page(`/staff/clientes/${cliA}`);
  ok(fichaOculta.status === 200 && !fichaOculta.html.includes("3311110001"),
    "la ficha tampoco");

  section("7. columnas de contacto cerradas en la tabla");
  const directo = await a(`customers?select=phone&id=eq.${cliA}`);
  const ownerDirecto = await owner(`customers?select=phone&id=eq.${cliA}`);
  if (ownerDirecto.status === 200) {
    console.log("  · migración 20261023120100 aún sin aplicar: se omite este bloque");
  } else {
    ok(directo.status >= 400, `nadie lee customers.phone con su sesión (${directo.status})`);
    const nombre = await a(`customers?select=id,name&id=eq.${cliA}`);
    ok(nombre.status === 200, "el nombre se sigue leyendo directo");
  }

  section("8. el admin, intacto");
  const delOwner = await json(await owner("customer_contacts?select=id,phone"));
  ok(delOwner.length === 4 && delOwner.every((c) => c.phone !== undefined),
    `ve a todos sus clientes por la vista (${delOwner.length})`);
  ok(delOwner.find((c) => c.id === cliA)?.phone === "3311110001", "con teléfono");

  section("9. quitar permisos aplica al momento");
  await setPerms({
    can_view_all_appointments: false, can_manage_all_appointments: false,
    customers_scope: "none", can_edit_customers: false, can_see_customer_contact: true,
  });
  const deVuelta = await json(await a("appointments?select=id"));
  ok(deVuelta.length === 1, "vuelve a ver sólo su cita, con la misma sesión");
  ok((await page("/staff/clientes")).status === 404, "y pierde la sección Clientes");
} finally {
  section("cleanup");
  await deleteBusiness(SLUG);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
