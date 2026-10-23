import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LEGAL } from "@/lib/legal";
import { Logo } from "@/components/landing/logo";

export const metadata: Metadata = {
  title: "Aviso de privacidad · ReservaPrimero",
  description:
    "Qué datos personales trata ReservaPrimero, para qué, con quién los comparte y cómo ejercer tus derechos ARCO.",
};

/** Proveedores que tratan datos por cuenta de ReservaPrimero (encargados). */
const PROVIDERS = [
  { name: "Supabase", what: "base de datos, cuentas de acceso e imágenes" },
  { name: "Vercel", what: "alojamiento de la aplicación" },
  { name: "Resend", what: "envío de correos de confirmación y recordatorio" },
  { name: "Meta (WhatsApp Business)", what: "envío de mensajes de WhatsApp" },
  { name: "Stripe", what: "cobro de la suscripción a los negocios" },
  { name: "Cloudflare", what: "protección del formulario contra spam (Turnstile) y DNS" },
];

export default function PrivacyPage() {
  const mail = (
    <a href={`mailto:${LEGAL.privacyEmail}`} className="font-medium text-primary hover:underline">
      {LEGAL.privacyEmail}
    </a>
  );

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo className="text-base" />
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Aviso de privacidad
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última actualización: {LEGAL.updatedAt}
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mb-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          <section>
            <h2>1. Quién es responsable de tus datos</h2>
            <p>
              ReservaPrimero (reservaprimero.com) es una plataforma de agenda de citas operada por{" "}
              <strong>{LEGAL.controller}</strong>
              {LEGAL.address ? <>, con domicilio en {LEGAL.address}</> : null}. Este aviso se emite
              conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares y su normativa aplicable.
            </p>
            <p className="mt-3">Según quién seas, el papel de cada uno cambia:</p>
            <ul className="mt-2">
              <li>
                <strong>Si reservas una cita en un negocio</strong> (por ejemplo en
                reservaprimero.com/nombre-del-negocio), el <strong>responsable</strong> de tus datos
                es ese negocio. ReservaPrimero actúa como <strong>encargado</strong>: los guarda y
                envía los avisos de tu cita por cuenta del negocio, y no los usa para nada más.
              </li>
              <li>
                <strong>Si tienes una cuenta</strong> (dueño de negocio o miembro de su equipo),
                ReservaPrimero es el responsable de los datos de tu cuenta.
              </li>
            </ul>
          </section>

          <section>
            <h2>2. Qué datos tratamos</h2>
            <p>
              <strong>Clientes que reservan:</strong> nombre, teléfono, correo electrónico (opcional),
              el comentario que dejes al reservar y el historial de tus citas en ese negocio
              (servicio, fecha, profesional y estado).
            </p>
            <p className="mt-3">
              <strong>Dueños y equipo:</strong> nombre, correo, teléfono, contraseña (guardada cifrada,
              nadie puede leerla), foto opcional, datos del negocio (nombre, dirección, logo, horarios)
              y los dispositivos en los que activas notificaciones. Los datos de pago de la
              suscripción los recibe directamente Stripe; ReservaPrimero no ve ni guarda números de
              tarjeta.
            </p>
            <p className="mt-3">
              <strong>Datos técnicos:</strong> dirección IP y tipo de navegador, sólo para seguridad
              (evitar reservas falsas y abusos) y para mantener tu sesión iniciada.
            </p>
          </section>

          <section>
            <h2>3. Datos sensibles</h2>
            <p>
              El formulario de reserva no pide datos sensibles. Sin embargo, algunos negocios (por
              ejemplo consultorios) pueden anotar en tu ficha información sobre tu salud como parte
              de tu historia clínica. Esas notas sólo las ve el administrador del negocio; ni su
              equipo ni ReservaPrimero las consultan. El negocio, como responsable, es quien debe
              informarte y obtener tu consentimiento expreso para registrarlas.
            </p>
          </section>

          <section>
            <h2>4. Para qué usamos tus datos</h2>
            <p>Finalidades necesarias para el servicio:</p>
            <ul className="mt-2">
              <li>Agendar, confirmar, reagendar o cancelar tu cita.</li>
              <li>
                Enviarte la confirmación y los recordatorios de tu cita por correo y/o WhatsApp, y el
                enlace para gestionarla.
              </li>
              <li>Permitir que el negocio te reconozca cuando vuelves a reservar.</li>
              <li>Dar acceso a su cuenta a dueños y equipo, y avisarles de sus citas.</li>
              <li>Cobrar la suscripción a los negocios y prevenir fraudes o abusos.</li>
            </ul>
            <p className="mt-3">
              No usamos tus datos para publicidad, no los vendemos y no los compartimos con otros
              negocios de la plataforma.
            </p>
          </section>

          <section>
            <h2>5. Con quién se comparten</h2>
            <p>
              Para funcionar, ReservaPrimero se apoya en proveedores que tratan los datos sólo
              siguiendo nuestras instrucciones. Algunos están fuera de México:
            </p>
            <ul className="mt-2">
              {PROVIDERS.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>: {p.what}.
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Fuera de estos casos, sólo entregaremos datos a una autoridad que los requiera
              conforme a la ley.
            </p>
          </section>

          <section>
            <h2>6. Cookies</h2>
            <p>
              Usamos únicamente cookies necesarias para mantener la sesión de dueños y equipo, y la
              verificación anti-spam del formulario de reserva. No usamos cookies de publicidad ni
              de analítica de terceros.
            </p>
          </section>

          <section>
            <h2>7. Tus derechos (ARCO) y cómo ejercerlos</h2>
            <p>
              Puedes <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>, pedir que
              se <strong>cancelen</strong>, <strong>oponerte</strong> a su uso, o revocar tu
              consentimiento. Escríbenos a {mail} indicando tu nombre, el teléfono o correo con el
              que reservaste o te registraste, el negocio (si aplica) y qué quieres hacer.
            </p>
            <p className="mt-3">
              Si tus datos son de una reserva, también puedes pedirlo directamente al negocio; si nos
              escribes a nosotros, se lo haremos llegar. Te responderemos en un plazo máximo de 20
              días hábiles.
            </p>
          </section>

          <section>
            <h2>8. Cuánto tiempo los conservamos</h2>
            <p>
              Mientras el negocio use ReservaPrimero o tu cuenta siga activa. Cuando un negocio da de
              baja su cuenta, se eliminan sus clientes, citas, notas e imágenes, y las cuentas de su
              equipo.
            </p>
          </section>

          <section>
            <h2>9. Cambios a este aviso</h2>
            <p>
              Si este aviso cambia, publicaremos la nueva versión en esta misma página con su fecha
              de actualización. Para cualquier duda: {mail}.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
