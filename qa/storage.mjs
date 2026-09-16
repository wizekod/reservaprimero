/**
 * Frontera del bucket `media`.
 *
 * La subida va directa del navegador a Storage con la sesión del usuario, así
 * que la política de `storage.objects` es el único control que hay: tiene que
 * impedir que el admin de un negocio escriba bajo el prefijo de otro, y que un
 * staff escriba en absoluto.
 */
import {
  RUN, createUser, deleteBusiness, deleteUser, insert, ok, rest, section,
  summary, URL_BASE,
} from "./lib.mjs";

const SLUG_A = `qa-st-a-${RUN}`;
const SLUG_B = `qa-st-b-${RUN}`;
const users = [];
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Sube como el usuario dueño del token. Devuelve el status HTTP. */
async function upload(token, path) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/png",
    },
    body: PNG,
  });
  return r.status;
}

const uuid = () => crypto.randomUUID();

section("setup");
const bizA = await insert("businesses", {
  name: "QA Storage A", slug: SLUG_A, status: "trial", timezone: "Europe/Madrid",
});
const bizB = await insert("businesses", {
  name: "QA Storage B", slug: SLUG_B, status: "trial", timezone: "Europe/Madrid",
});

const mk = async (email) => {
  const u = await createUser(email);
  users.push(u.uid);
  return u;
};
const ownerA = await mk(`qa-st-a-${RUN}@example.com`);
const ownerB = await mk(`qa-st-b-${RUN}@example.com`);
const staffU = await mk(`qa-st-s-${RUN}@example.com`);

await rest(`profiles?id=eq.${ownerA.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizA.id }),
});
await rest(`profiles?id=eq.${ownerB.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizB.id }),
});
await rest(`profiles?id=eq.${staffU.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: bizA.id, role: "staff" }),
});
ok(true, "dos negocios, dos dueños y un staff");

const subidas = [];

try {
  section("1. el dueño sube bajo su propio prefijo");
  const propia = `${bizA.id}/staff/${uuid()}.png`;
  const s1 = await upload(ownerA.token, propia);
  ok(s1 === 200, `sube su avatar (${s1})`);
  if (s1 === 200) subidas.push(propia);

  const svc = `${bizA.id}/services/${uuid()}.png`;
  const s2 = await upload(ownerA.token, svc);
  ok(s2 === 200, `sube la imagen de un servicio (${s2})`);
  if (s2 === 200) subidas.push(svc);

  section("2. no puede escribir en el prefijo de otro negocio");
  const ajena = `${bizB.id}/staff/${uuid()}.png`;
  const s3 = await upload(ownerA.token, ajena);
  ok(s3 >= 400, `el dueño de A no escribe bajo B (${s3})`);

  const s4 = await upload(ownerB.token, `${bizA.id}/staff/${uuid()}.png`);
  ok(s4 >= 400, `el dueño de B no escribe bajo A (${s4})`);

  section("3. rutas que no son de nadie");
  for (const mala of ["suelto.png", `no-uuid/staff/${uuid()}.png`, `../${bizA.id}/x.png`]) {
    const st = await upload(ownerA.token, mala);
    ok(st >= 400, `rechaza "${mala}" (${st})`);
  }

  section("4. el staff no sube nada");
  const s5 = await upload(staffU.token, `${bizA.id}/staff/${uuid()}.png`);
  ok(s5 >= 400, `un staff no puede subir (${s5})`);

  section("5. sin sesión");
  const s6 = await upload(ANON, `${bizA.id}/staff/${uuid()}.png`);
  ok(s6 >= 400, `anon no puede subir (${s6})`);

  section("6. lo subido se lee sin sesión (bucket público)");
  const pub = await fetch(`${URL_BASE}/storage/v1/object/public/media/${subidas[0]}`);
  ok(pub.status === 200, `la imagen se sirve por URL pública (${pub.status})`);

  const listado = await fetch(`${URL_BASE}/storage/v1/object/list/media`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: `${bizA.id}/`, limit: 100 }),
  });
  const filas = await listado.json();
  ok(
    listado.status >= 400 || (Array.isArray(filas) && filas.length === 0),
    `anon no puede listar la carpeta del negocio (${listado.status})`,
  );

  section("7. borrar es cosa del dueño");
  const delAjeno = await fetch(`${URL_BASE}/storage/v1/object/media/${subidas[0]}`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: `Bearer ${ownerB.token}` },
  });
  const sigue = await fetch(`${URL_BASE}/storage/v1/object/public/media/${subidas[0]}`);
  ok(sigue.status === 200, `el dueño de B no borra la imagen de A (${delAjeno.status})`);
} finally {
  section("cleanup");
  for (const p of subidas) {
    await fetch(`${URL_BASE}/storage/v1/object/media/${p}`, {
      method: "DELETE",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
  }
  await deleteBusiness(SLUG_A);
  await deleteBusiness(SLUG_B);
  for (const uid of users) await deleteUser(uid);
  ok(true, "datos de prueba borrados");
}

summary();
