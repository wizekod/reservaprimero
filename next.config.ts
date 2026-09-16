import type { NextConfig } from "next";

/**
 * `allowedDevOrigins` sólo afecta al servidor de desarrollo: Next bloquea por
 * defecto las peticiones a sus recursos internos (HMR, acciones de servidor)
 * que llegan desde un host distinto de localhost. Sin esto, al abrir la app
 * desde el móvil por la IP de la red el toque no hace nada: el manejador se
 * ejecuta pero la acción de servidor nunca responde.
 *
 * La IP la inyecta `npm run dev:lan` (scripts/dev-lan.mjs), que la resuelve en
 * cada arranque. En producción no interviene.
 */
const devLanHost = process.env.DEV_LAN_HOST;

const nextConfig: NextConfig = {
  ...(devLanHost ? { allowedDevOrigins: [devLanHost] } : {}),
};

export default nextConfig;
