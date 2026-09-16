/**
 * Servidor de desarrollo accesible desde la red local, para probar en el móvil.
 *
 * Hace dos cosas que `npm run dev` no hace:
 *
 *   - escucha en 0.0.0.0 en vez de sólo en localhost;
 *   - apunta `NEXT_PUBLIC_APP_URL` a la IP de esta máquina, para que los
 *     enlaces que genera la app (el de cancelar/reagendar una reserva, el QR
 *     de la página pública) funcionen al abrirlos desde el teléfono en vez de
 *     apuntar a un localhost que allí no existe.
 *
 * La IP se resuelve en cada arranque porque cambia al saltar de red.
 */
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

function localIp() {
  // Se prefiere el rango privado habitual de una red doméstica u oficina.
  const candidatas = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);

  return (
    candidatas.find((a) => a.startsWith("192.168.")) ??
    candidatas.find((a) => a.startsWith("10.")) ??
    candidatas[0]
  );
}

const ip = localIp();
if (!ip) {
  console.error("No se encontró una IP de red local. ¿Estás conectado a una red?");
  process.exit(1);
}

const url = `http://${ip}:3000`;
console.log(`\n  Desde este ordenador:  http://localhost:3000`);
console.log(`  Desde el móvil:        ${url}`);
console.log(`  (misma red wifi; si no carga, revisa el cortafuegos de macOS)\n`);

spawn("npx", ["next", "dev", "-H", "0.0.0.0"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_APP_URL: url,
    // Lo lee next.config.ts: sin declarar este origen, Next bloquea sus
    // recursos de desarrollo (HMR, acciones de servidor) al venir de una IP
    // que no es localhost, y en el móvil los botones no harían nada.
    DEV_LAN_HOST: ip,
  },
}).on("exit", (code) => process.exit(code ?? 0));
