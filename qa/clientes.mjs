/**
 * Identidad del cliente por teléfono.
 *
 * Lo que se protege aquí: que el mismo número escrito de tres formas sea una
 * sola ficha, que dos reservas simultáneas no creen dos, que la unicidad sea
 * por negocio (no global) y que un teléfono no canonizable no fusione a dos
 * personas distintas.
 */
import {
  RUN, deleteBusiness, insert, ok, rest, rpc, section, summary,
} from "./lib.mjs";

const SLUG_A = `qa-cli-a-${RUN}`;
const SLUG_B = `qa-cli-b-${RUN}`;

section("setup");
const bizA = await insert("businesses", {
  name: "QA Clientes A", slug: SLUG_A, status: "trial",
  timezone: "America/Mexico_City",
});
const bizB = await insert("businesses", {
  name: "QA Clientes B", slug: SLUG_B, status: "trial",
  timezone: "America/Mexico_City",
});
ok(bizA.phone_country_code === "52", "el prefijo se deduce de la zona horaria (52)");
ok(bizB.id !== bizA.id, "dos negocios independientes");

const up = (biz, name, phone, email) =>
  rpc("upsert_customer", {
    p_business_id: biz.id, p_name: name, p_phone: phone,
    ...(email ? { p_email: email } : {}),
  });

const countCustomers = async (biz) => {
  const r = await rest(`customers?select=id&business_id=eq.${biz.id}`);
  return (await r.json()).length;
};

try {
  section("1. el mismo número en tres formatos es una sola ficha");
  const primero = await up(bizA, "Ana Gómez", "331 910 11 68", "ana@example.com");
  ok(primero.status === 200 && typeof primero.body === "string", "alta inicial");

  const formatos = ["+52 331 910 1168", "00523319101168", "3319101168"];
  for (const f of formatos) {
    const r = await up(bizA, "ana", f);
    ok(r.body === primero.body, `"${f}" resuelve al mismo cliente`);
  }
  ok((await countCustomers(bizA)) === 1, "sólo existe una ficha");

  section("2. los datos ya guardados no se degradan");
  const r = await rest(`customers?select=name,email,phone_key&id=eq.${primero.body}`);
  const [c] = await r.json();
  ok(c.name === "ANA GÓMEZ", "el nombre curado no lo pisa una reserva posterior (y va en mayúsculas)");
  ok(c.email === "ana@example.com", "el email se conserva");
  ok(c.phone_key === "+523319101168", "la clave queda en E.164");

  section("3. un email nuevo sí rellena el hueco");
  const sinEmail = await up(bizA, "Beto", "3311112222");
  await up(bizA, "Beto", "3311112222", "beto@example.com");
  const r2 = await rest(`customers?select=email&id=eq.${sinEmail.body}`);
  ok((await r2.json())[0].email === "beto@example.com", "el email que faltaba se completa");

  section("4. la identidad es por negocio, no global");
  const enB = await up(bizB, "Ana Gómez", "3319101168");
  ok(enB.body !== primero.body, "el mismo número en otro negocio es otra ficha");
  ok((await countCustomers(bizB)) === 1, "el negocio B tiene su propia ficha");

  section("5. dos reservas simultáneas con el mismo teléfono");
  const antes = await countCustomers(bizA);
  const carrera = await Promise.all(
    Array.from({ length: 5 }, () => up(bizA, "Concurrente", "3355556666")),
  );
  const ids = new Set(carrera.map((x) => x.body));
  ok(carrera.every((x) => x.status === 200), "ninguna llamada falla");
  ok(ids.size === 1, "las 5 devuelven el mismo cliente");
  ok((await countCustomers(bizA)) === antes + 1, "sólo se creó una ficha");

  section("6. nombre en mayúsculas, lo escriba quien lo escriba");
  const minus = await up(bizA, "pepa de la torre", "3399998888");
  const rp = await rest(`customers?select=name&id=eq.${minus.body}`);
  ok((await rp.json())[0].name === "PEPA DE LA TORRE",
    "el RPC guarda el nombre en mayúsculas");

  await rest(`customers?id=eq.${minus.body}`, {
    method: "PATCH", body: JSON.stringify({ name: "  pepa corregida  " }),
  });
  const rp2 = await rest(`customers?select=name&id=eq.${minus.body}`);
  ok((await rp2.json())[0].name === "PEPA CORREGIDA",
    "un UPDATE directo también se normaliza");

  section("7. un teléfono no canonizable no fusiona a nadie");
  const basura1 = await up(bizA, "Sin teléfono", "123");
  const basura2 = await up(bizA, "Otra persona", "456");
  ok(basura1.body !== basura2.body, "dos números ilegibles no se fusionan entre sí");
  const r3 = await rest(`customers?select=phone_key&id=eq.${basura1.body}`);
  ok((await r3.json())[0].phone_key === null, "sin clave: queda fuera del índice único");
} finally {
  section("cleanup");
  await deleteBusiness(SLUG_A);
  await deleteBusiness(SLUG_B);
  ok(true, "negocios de prueba borrados");
}

summary();
