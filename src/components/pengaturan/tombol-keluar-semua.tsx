"use client";

import { useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { keluarSemuaPerangkat } from "@/lib/auth/actions";

export function TombolKeluarSemua() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Keluar dari semua perangkat, termasuk perangkat ini?")) {
          startTransition(() => keluarSemuaPerangkat());
        }
      }}
      className={buttonClass("bahaya")}
    >
      {pending ? "Memproses…" : "Keluar dari semua perangkat"}
    </button>
  );
}
