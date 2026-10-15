import type { Metadata } from "next";

/**
 * Metadatos de la web app instalable. Sólo en los paneles y en el login, no
 * en la raíz: si un cliente agregara a su pantalla de inicio la página de
 * reservas de un negocio, el `start_url` lo mandaría al panel.
 *
 * En iPhone las notificaciones push sólo existen con la web app agregada a
 * la pantalla de inicio, y para eso hace falta el manifiesto con
 * `display: standalone`.
 */
export const pwaMetadata: Metadata = {
  manifest: "/app.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ReservaPrimero",
    statusBarStyle: "default",
  },
};
