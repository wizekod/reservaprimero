/**
 * Notificaciones push al equipo: la tabla de dispositivos.
 *
 * Lo que se protege: que la RLS no deje a un usuario ver, crear o borrar
 * dispositivos ajenos (el alta sólo pasa por la acción de servidor, que toma
 * la identidad de la sesión), y que los dispositivos desaparezcan con la
 * cuenta.
 *
 * El envío en sí no se prueba aquí a propósito: dispararlo pasa por el cron,
 * que recorre todos los negocios reales y marcaría como enviado su resumen
 * del día.
 */
import { createECDH, randomBytes } from "node:crypto";

import {
  RUN, asUser, createUser, deleteBusiness, deleteUser, insert, ok, rest,
  section, summary,
} from "./lib.mjs";

const SLUG = `qa-push-${RUN}`;
const users = [];

function device(name) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://push.example.com/qa-${RUN}/${name}`,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

section("setup");
const biz = await insert("businesses", {
  name: "QA Push", slug: SLUG, status: "trial", timezone: "America/Mexico_City",
});

const owner = await createUser(`qa-push-owner-${RUN}@example.com`);
users.push(owner.uid);
await rest(`profiles?id=eq.${owner.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: biz.id }),
});

const proUser = await createUser(`qa-push-pro-${RUN}@example.com`);
users.push(proUser.uid);
await rest(`profiles?id=eq.${proUser.uid}`, {
  method: "PATCH", body: JSON.stringify({ business_id: biz.id, role: "staff" }),
});

await insert("push_subscriptions", { profile_id: owner.uid, ...device("owner") });
await insert("push_subscriptions", { profile_id: proUser.uid, ...device("pro-movil") });
await insert("push_subscriptions", { profile_id: proUser.uid, ...device("pro-compu") });
ok(true, "dueño con un dispositivo y profesional con dos");

try {
  section("1. cada quien sólo ve sus dispositivos");
  const asOwner = asUser(owner.token);
  const asPro = asUser(proUser.token);
  const mine = await (await asOwner("push_subscriptions?select=profile_id")).json();
  ok(
    Array.isArray(mine) && mine.length === 1 && mine[0].profile_id === owner.uid,
    `el dueño ve sólo el suyo (${mine.length})`,
  );
  const proRows = await (await asPro("push_subscriptions?select=profile_id")).json();
  ok(proRows.length === 2, `el profesional ve sus dos (${proRows.length})`);

  section("2. nadie registra ni edita dispositivos por la API");
  const ins = await asOwner("push_subscriptions", {
    method: "POST",
    body: JSON.stringify({ profile_id: proUser.uid, ...device("intruso") }),
  });
  ok(ins.status >= 400, `alta directa rechazada (${ins.status})`);
  const insOwn = await asOwner("push_subscriptions", {
    method: "POST",
    body: JSON.stringify({ profile_id: owner.uid, ...device("propio") }),
  });
  ok(insOwn.status >= 400, `ni siquiera a su nombre: el alta va por el servidor (${insOwn.status})`);
  const upd = await asOwner(`push_subscriptions?profile_id=eq.${owner.uid}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ profile_id: proUser.uid }),
  });
  ok(upd.status >= 400, `no puede pasarle su dispositivo a otro (${upd.status})`);

  section("3. borrar: sólo lo propio");
  await asPro(`push_subscriptions?profile_id=eq.${owner.uid}`, { method: "DELETE" });
  const ownerLeft = await (await rest(`push_subscriptions?select=id&profile_id=eq.${owner.uid}`)).json();
  ok(ownerLeft.length === 1, "el profesional no puede borrar el del dueño");
  await asOwner(`push_subscriptions?profile_id=eq.${owner.uid}`, { method: "DELETE" });
  const ownerGone = await (await rest(`push_subscriptions?select=id&profile_id=eq.${owner.uid}`)).json();
  ok(ownerGone.length === 0, "el dueño sí puede desactivar el suyo");

  section("4. el canal push existe en el log");
  const log = await rest("notifications_log?select=channel&channel=eq.push&limit=1");
  ok(log.status === 200, `notifications_log admite channel = push (${log.status})`);
} finally {
  section("cleanup");
  await deleteBusiness(SLUG);
  for (const uid of users) await deleteUser(uid);
  const left = await (await rest(`push_subscriptions?select=id&endpoint=like.${encodeURIComponent(`https://push.example.com/qa-${RUN}/`)}*`)).json();
  ok(left.length === 0, "los dispositivos se borran con sus cuentas");
}

summary();
