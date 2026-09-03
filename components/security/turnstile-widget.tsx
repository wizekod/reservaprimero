"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { clientEnv } from "@/lib/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

/**
 * Widget de Cloudflare Turnstile. Si no hay `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * configurada, no renderiza nada y llama a `onToken("")` (modo protegido: el
 * servidor tampoco verificará).
 */
export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const siteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      onToken("");
      return;
    }
    if (!ready || !ref.current || !window.turnstile) return;

    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, ready, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onLoad={() => setReady(true)}
      />
      <div ref={ref} />
    </>
  );
}
