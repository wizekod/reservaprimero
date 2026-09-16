/**
 * Utilidades compartidas de la suite QA.
 *
 * Los tests corren contra el Supabase real (no hay entorno de staging), así
 * que cada script crea sus propios negocios con un slug prefijado por `qa-` y
 * los borra al terminar. Nunca tocan datos que no hayan creado ellos.
 *
 * Uso:  node --env-file=.env.local qa/<script>.mjs
 */

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Falta ${k}. Ejecuta: node --env-file=.env.local qa/…`);
    process.exit(1);
  }
  return v;
};

export const URL_BASE = need("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");

const SERVICE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

/** PostgREST con service_role (BYPASSA RLS). */
export async function rest(path, init = {}) {
  return fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...SERVICE_HEADERS, ...(init.headers ?? {}) },
  });
}

/** INSERT que devuelve la fila creada. */
export async function insert(table, body) {
  const r = await rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const rows = await r.json();
  if (!r.ok) throw new Error(`insert ${table}: ${JSON.stringify(rows)}`);
  return Array.isArray(rows) ? rows[0] : rows;
}

/** Llama a una función RPC como service_role. */
export async function rpc(name, args) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: SERVICE_HEADERS,
    body: JSON.stringify(args),
  });
  return { status: r.status, body: await r.json() };
}

/** PostgREST con la sesión de un usuario concreto (SÍ aplica RLS). */
export function asUser(accessToken) {
  return (path, init = {}) =>
    fetch(`${URL_BASE}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
}

/** Crea un usuario confirmado y devuelve { uid, token }. */
export async function createUser(email, password = "Qa-passw0rd!") {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: SERVICE_HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const u = await r.json();
  if (!r.ok) throw new Error(`createUser: ${JSON.stringify(u)}`);

  const s = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const sess = await s.json();
  if (!s.ok) throw new Error(`login: ${JSON.stringify(sess)}`);
  return { uid: u.id, token: sess.access_token };
}

/**
 * Cookie de sesión con el formato de `@supabase/ssr`, para pedir páginas del
 * servidor de desarrollo como ese usuario (y no sólo la API REST).
 */
export function sessionCookie(session) {
  const ref = new URL(URL_BASE).hostname.split(".")[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  return `sb-${ref}-auth-token=${value}`;
}

/** Inicia sesión y devuelve el objeto de sesión completo. */
export async function login(email, password = "Qa-passw0rd!") {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const s = await r.json();
  if (!r.ok) throw new Error(`login: ${JSON.stringify(s)}`);
  return s;
}

export async function deleteUser(uid) {
  await fetch(`${URL_BASE}/auth/v1/admin/users/${uid}`, {
    method: "DELETE",
    headers: SERVICE_HEADERS,
  });
}

/** Borra un negocio por slug (las FK en cascada limpian lo suyo). */
export async function deleteBusiness(slug) {
  await rest(`businesses?slug=eq.${slug}`, { method: "DELETE" });
}

// ── Aserciones ─────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

export function ok(cond, msg) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${msg}`);
  }
}

export function section(title) {
  console.log(`\n# ${title}`);
}

export function summary() {
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

/** Sufijo único para no chocar con ejecuciones anteriores. */
export const RUN = Math.random().toString(36).slice(2, 8);
