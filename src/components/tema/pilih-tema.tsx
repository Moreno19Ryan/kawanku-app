"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { PilihanTema } from "@/lib/tema";
import { bacaPilihanTema, langgananTema, terapkanTema } from "./tema-client";

const OPSI: { nilai: PilihanTema; label: string; icon: typeof Sun }[] = [
  { nilai: "terang", label: "Terang", icon: Sun },
  { nilai: "gelap", label: "Gelap", icon: Moon },
  { nilai: "sistem", label: "Ikut perangkat", icon: Monitor },
];

/** Pilihan tema: terang, gelap, atau ikut perangkat. Disimpan per perangkat. */
export function PilihTema() {
  // Server tidak tahu pilihan (localStorage), jadi null dulu lalu diisi di browser.
  const pilihan = useSyncExternalStore(langgananTema, bacaPilihanTema, () => null);

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 sm:gap-3">
      {OPSI.map(({ nilai, label, icon: Icon }) => {
        const aktif = pilihan === nilai;
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => terapkanTema(nilai)}
            className={`flex flex-col items-center gap-2 rounded-card border-2 px-3 py-4 text-sm font-medium transition-colors duration-200 ease-oneui ${
              aktif
                ? "border-primary bg-primary-soft text-primary"
                : "border-transparent bg-surface-muted text-fg hover:border-border"
            }`}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
