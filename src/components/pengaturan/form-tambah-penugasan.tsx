"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";

export type OpsiPeran = { id: string; nama: string; wilayah: "desa" | "kelompok" | "fleksibel" };
export type OpsiKelompok = { id: string; nama: string };

/** Tambah peran untuk satu admin: pilih peran, lalu kelompok bila perlu. */
export function FormTambahPenugasan({
  aksi,
  peran,
  kelompok,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  peran: OpsiPeran[];
  kelompok: OpsiKelompok[];
}) {
  const [state, action, pending] = useActionState(aksi, {});
  const [peranId, setPeranId] = useState("");
  const wilayah = peran.find((p) => p.id === peranId)?.wilayah;

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="peran_id"
          required
          value={peranId}
          onChange={(e) => setPeranId(e.target.value)}
          aria-label="Peran"
          className={`${INPUT_CLASS} h-10 w-full text-sm sm:flex-1`}
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
            className={`${INPUT_CLASS} h-10 w-full text-sm sm:flex-1`}
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

        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10")}>
          {pending ? "Menambah…" : "Tambah peran"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
