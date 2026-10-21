"use client";

import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/input";

export type OpsiPeran = {
  id: string;
  nama: string;
  wilayah: "desa" | "kelompok" | "fleksibel";
  /** Pemanggil boleh memberi peran ini untuk seluruh desa. */
  bolehDesa: boolean;
  /** Kelompok tempat pemanggil boleh memberi peran ini. */
  kelompokIds: string[];
};
export type OpsiKelompok = { id: string; nama: string };

/**
 * Pilihan peran + wilayah (name: peran_id, kelompok_id). Kelompok disembunyikan
 * untuk peran tingkat desa, wajib untuk peran kelompok, dan opsional
 * ("Seluruh desa") untuk peran fleksibel. Hanya wilayah yang boleh diberikan
 * pemanggil yang ditawarkan (aturan sebenarnya tetap di RLS).
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
  const dipilih = peran.find((p) => p.id === peranId);
  const wilayah = dipilih?.wilayah;
  const opsiDesa = wilayah === "fleksibel" && dipilih?.bolehDesa;
  const opsiKelompok = kelompok.filter((k) => dipilih?.kelompokIds.includes(k.id));

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
          key={peranId}
          name="kelompok_id"
          required={!opsiDesa}
          defaultValue=""
          aria-label="Wilayah"
          className={`${INPUT_CLASS} w-full text-sm sm:flex-1 ${className}`}
        >
          <option value="" disabled={!opsiDesa}>
            {opsiDesa ? "Seluruh desa" : "Pilih kelompok…"}
          </option>
          {opsiKelompok.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
