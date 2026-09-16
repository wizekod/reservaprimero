/**
 * Frontera de la historia clínica.
 *
 * La decisión de producto es que SÓLO el admin del negocio ve y escribe la
 * historia clínica. El staff sigue viendo la ficha del cliente (necesita su
 * nombre y teléfono para atenderle) pero no debe ver una sola nota.
 *
 * Por eso vive en `customer_notes`, tabla aparte: una columna en `customers`
 * sería ilegible de proteger, porque la RLS filtra filas y no columnas y un
 * REVOKE por columna no resta a un GRANT de tabla.
 */
import {
  RUN, asUser, createUser, deleteBusiness, deleteUser, insert, ok, rest,
  rpc, section, summary, URL_BASE,
} from "./lib.mjs";

const SLUG_A = `qa-hc-a-${RUN}`;
const SLUG_B = `qa-hc-b-${RUN}`;
const users = [];

const mkUser = async (email) => {
  const u = await createUser(email);
  users.push(u.uid);
  return u;
};

section("setup");
const bizA = await insert("businesses", {
  name: "QA Clínica A", slug: SLUG_A, status: "trial", timezone: "Europe/Madrid",
});
const bizB = await insert("businesses", {
  name: "QA Clínica B", slug: SLUG_B, status: "trial", timezone: "Europe/Madrid",
});

const ownerA = await mkUser(`qa-owner-a-${RUN}@example.com`);
const ownerB = await mkUser(`qa-owner-b-${RUN}@example.com`);
const staffU = await mkUser(`qa-staff-${RUN}@example.com`);

await rest(`profiles?id=eq.${ownerA.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizA.id }),
});
await rest(`profiles?id=eq.${ownerB.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizB.id }),
});
await rest(`profiles?id=eq.${staffU.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizA.id, role: "staff" }),
});

const srv = await insert("services", {
  business_id: bizA.id, name: "Consulta", duration_minutes: 30, price: 40,
});
const sm = await insert("staff_members", {
  business_id: bizA.id, display_name: "Dra. QA", profile_id: staffU.uid,
});

const cliente = (await rpc("upsert_customer", {
  p_business_id: bizA.id, p_name: "Paciente QA", p_phone: "600112233",
})).body;

const start = new Date(Date.now() + 86_400_000);
await insert("appointments", {
  business_id: bizA.id, service_id: srv.id, staff_member_id: sm.id,
  customer_id: cliente, status: "confirmed",
  start_at: start.toISOString(),
  end_at: new Date(start.getTime() + 1_800_000).toISOString(),
});

const nota = await insert("customer_notes", {
  business_id: bizA.id, customer_id: cliente,
  body: "Alergia a la lidocaína. NO debe verlo el staff.",
  pinned: true,
});
ok(!!nota.id, "negocios, usuarios, cita y nota creados");

const a = asUser(ownerA.token);
const b = asUser(ownerB.token);
const s = asUser(staffU.token);
const rows = async (fn, path) => (await (await fn(path)).json());

try {
  section("1. el admin del negocio sí");
  ok((await rows(a, `customer_notes?select=id,body`)).length === 1,
    "el dueño lee la historia clínica de su cliente");

  const ins = await a("customer_notes", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_id: bizA.id, customer_id: cliente, body: "Segunda sesión.",
    }),
  });
  ok(ins.status === 201, "el dueño añade una entrada");

  section("2. el staff ve al cliente pero NO su historia clínica");
  const vistos = await rows(s, `customers?select=id,name`);
  ok(vistos.length === 1 && vistos[0].id === cliente,
    "el staff sigue viendo la ficha del cliente que atiende");

  const notasStaff = await rows(s, `customer_notes?select=id,body`);
  ok(Array.isArray(notasStaff) && notasStaff.length === 0,
    "el staff no ve NINGUNA entrada de la historia clínica");

  const insStaff = await s("customer_notes", {
    method: "POST",
    body: JSON.stringify({
      business_id: bizA.id, customer_id: cliente, body: "intento del staff",
    }),
  });
  ok(insStaff.status >= 400, `el staff no puede escribir (${insStaff.status})`);

  const delStaff = await s(`customer_notes?id=eq.${nota.id}`, { method: "DELETE" });
  const sigue = await rows(a, `customer_notes?select=id&id=eq.${nota.id}`);
  ok(sigue.length === 1, `el staff no puede borrar (${delStaff.status})`);

  section("3. aislamiento entre negocios");
  ok((await rows(b, `customer_notes?select=id`)).length === 0,
    "el dueño de otro negocio no ve nada");

  const insB = await b("customer_notes", {
    method: "POST",
    body: JSON.stringify({
      business_id: bizA.id, customer_id: cliente, body: "intento cruzado",
    }),
  });
  ok(insB.status >= 400, `no puede escribir en el negocio ajeno (${insB.status})`);

  section("4. sin sesión");
  const anon = await fetch(`${URL_BASE}/rest/v1/customer_notes?select=id`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  });
  const anonBody = await anon.json();
  ok(anon.status >= 400 || (Array.isArray(anonBody) && anonBody.length === 0),
    `anon no lee historias clínicas (${anon.status})`);

  section("5. integridad");
  const cruzada = await rest("customer_notes", {
    method: "POST",
    body: JSON.stringify({
      business_id: bizB.id, customer_id: cliente, body: "business_id que no cuadra",
    }),
  });
  ok(cruzada.status >= 400,
    `business_id no puede divergir del negocio del cliente (${cruzada.status})`);

  const vacia = await rest("customer_notes", {
    method: "POST",
    body: JSON.stringify({ business_id: bizA.id, customer_id: cliente, body: "   " }),
  });
  ok(vacia.status >= 400, `no se admiten entradas vacías (${vacia.status})`);
} finally {
  section("cleanup");
  await deleteBusiness(SLUG_A);
  await deleteBusiness(SLUG_B);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
