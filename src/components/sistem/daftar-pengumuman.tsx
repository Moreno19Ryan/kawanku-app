"use client";

import { useState } from "react";
import { Info, TriangleAlert, X } from "lucide-react";

type Item = { id: string; pesan: string; nada: "info" | "peringatan" };

/** Banner pengumuman; bisa ditutup (selama aplikasi tidak dimuat ulang). */
export function DaftarPengumuman({ pengumuman }: { pengumuman: Item[] }) {
  const [ditutup, setDitutup] = useState<string[]>([]);
  const tampil = pengumuman.filter((p) => !ditutup.includes(p.id));
  if (tampil.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 lg:mt-6">
      {tampil.map((p) => {
        const peringatan = p.nada === "peringatan";
        const Icon = peringatan ? TriangleAlert : Info;
        return (
          <div
            key={p.id}
            role="status"
            className={`flex items-start gap-3 rounded-control px-4 py-3 text-sm ${
              peringatan ? "bg-warning/15" : "bg-primary-soft"
            }`}
          >
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${peringatan ? "text-warning" : "text-primary"}`}
              aria-hidden
            />
            <p className="min-w-0 flex-1">{p.pesan}</p>
            <button
              type="button"
              onClick={() => setDitutup((d) => [...d, p.id])}
              aria-label="Tutup pengumuman"
              className="-m-1 rounded-pill p-1 text-muted hover:bg-surface hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
