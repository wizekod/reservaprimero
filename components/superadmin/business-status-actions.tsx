"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setBusinessStatus } from "@/lib/superadmin/actions";
import type { BusinessStatus } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";

export function BusinessStatusActions({
  id,
  status,
}: {
  id: string;
  status: BusinessStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function run(next: BusinessStatus, needsConfirm: boolean) {
    if (needsConfirm && !confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await setBusinessStatus(id, next);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Error");
      setConfirm(false);
    });
  }

  if (status === "suspended") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run("active", false)}
      >
        Reactivar
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive"
      onClick={() => run("suspended", true)}
    >
      {confirm ? "¿Suspender?" : "Suspender"}
    </Button>
  );
}
