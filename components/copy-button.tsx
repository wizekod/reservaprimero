"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  className,
  label = "Copiar",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }, () => {})
      }
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copiado" : label}
    </button>
  );
}
