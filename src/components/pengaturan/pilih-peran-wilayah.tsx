"use client";

import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/input";

export type OpsiPeran = { id: string; nama: string; wilayah: "desa" | "kelompok" | "fleksibel" };
export type OpsiKelompok = { id: string; nama: string };

/**
 * Pilihan peran + wilayah (name: peran_id, kelompok_id). Kelompok disembunyikan
 * untuk peran tingkat desa, wajib untuk peran kelompok, dan opsional
 * ("Seluruh desa") untuk peran fleksibel.
 */
export function PilihPeranWilayah({
  peran,
  kelompok,
  className = "",
}: {
  peran: OpsiPeran[];
  kelompok: OpsiKelompok[];
  className?: string;
}) {
  const [peranId, setPeranId] = useState("");
  const wilayah = peran.find((p) => p.id === peranId)?.wilayah;

  return (
    <>
      <select
        name="peran_id"
        required
        value={peranId}
        onChange={(e) => setPeranId(e.target.value)}
        aria-label="Peran"
        className={`${INPUT_CLASS} w-full text-sm sm:flex-1 ${className}`}
      >
        <option value="">Pilih peran…</option>
        {peran.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nama}
          </option>
        ))}
      </select>

      {wilayah && wilayah !== "desa" && (
        <select
          name="kelompok_id"
          required={wilayah === "kelompok"}
          defaultValue=""
          aria-label="Wilayah"
          className={`${INPUT_CLASS} w-full text-sm sm:flex-1 ${className}`}
        >
          <option value="" disabled={wilayah === "kelompok"}>
            {wilayah === "kelompok" ? "Pilih kelompok…" : "Seluruh desa"}
          </option>
          {kelompok.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
