/**
 * Reconocimiento del cliente en la página pública de reservas.
 *
 * Autorrellenar los datos de quien ya reservó es cómodo, pero expone algo:
 * quien acierte un número completo averigua si esa persona es clienta del
 * negocio. Lo que se protege aquí es que no se pueda TANTEAR —con números a
 * medias no responde— y que no se filtre nada más allá del nombre y el correo.
 *
 * Necesita el servidor de desarrollo levantado.
 */
import {
  RUN, deleteBusiness, insert, ok, rest, rpc, section, summary,
} from "./lib.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const SLUG_A = `qa-rec-a-${RUN}`;
const SLUG_B = `qa-rec-b-${RUN}`;

/**
 * Invoca la server action como lo hace el navegador. El id de la acción es un
 * hash del build, así que se lee del bundle de la página en vez de fijarlo.
 */
async function lookup(slug, phone) {
  const html = await (await fetch(`${BASE}/${slug}`)).text();
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]);

  for (const c of new Set(chunks)) {
    const js = await (await fetch(BASE + c)).text();
    const m = /\(0,[a-zA-Z_$][\w$]*\.createServerReference\)\("([0-9a-f]{40,})"[^)]*?"lookupPublicCustomer"/.exec(js)
      ?? /"([0-9a-f]{40,})"[^\n]{0,200}lookupPublicCustomer/.exec(js);
    if (!m) continue;

    const r = await fetch(`${BASE}/${slug}`, {
      method: "POST",
      headers: { "Next-Action": m[1], "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify([slug, phone]),
    });
    const text = await r.text();
    return { status: r.status, text };
  }
  return null;
}

section("setup");
const bizA = await insert("businesses", {
  name: "QA Reconocer A", slug: SLUG_A, status: "trial",
  timezone: "America/Mexico_City",
});
const bizB = await insert("businesses", {
  name: "QA Reconocer B", slug: SLUG_B, status: "trial",
  timezone: "America/Mexico_City",
});
await rpc("upsert_customer", {
  p_business_id: bizA.id, p_name: "Rosa Clienta", p_phone: "3344556677",
  p_email: "rosa@example.com",
});
ok(true, "negocio con un cliente conocido");

try {
  const completo = await lookup(SLUG_A, "3344556677");

  if (!completo) {
    ok(false, "no se pudo localizar la server action en el bundle");
  } else {
    section("1. con el número completo reconoce");
    ok(completo.status === 200, `la acción responde (${completo.status})`);
    ok(completo.text.includes("ROSA CLIENTA"), "devuelve el nombre");
    ok(completo.text.includes("rosa@example.com"), "y el correo");

    section("2. no filtra nada más");
    for (const campo of ["phone_key", "business_id", '"id"', "created_at"]) {
      ok(!completo.text.includes(campo), `no expone ${campo}`);
    }

    section("3. con números a medias no responde");
    for (const parcial of ["334455", "33445566", "3344556677889"]) {
      const r = await lookup(SLUG_A, parcial);
      ok(
        r !== null && !r.text.includes("ROSA CLIENTA"),
        `"${parcial}" (${parcial.replace(/\D/g, "").length} dígitos) no reconoce`,
      );
    }

    section("4. el reconocimiento es por negocio");
    const otro = await lookup(SLUG_B, "3344556677");
    ok(
      otro !== null && !otro.text.includes("ROSA CLIENTA"),
      "otro negocio no ve a la clienta",
    );
  }
} finally {
  section("cleanup");
  await deleteBusiness(SLUG_A);
  await deleteBusiness(SLUG_B);
  ok(true, "negocios de prueba borrados");
}

summary();
