"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Saklar } from "@/components/ui/saklar";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";

type Kelompok = { id: string; nama: string };

/** Satu fitur: nyala/mati, untuk semua kelompok atau kelompok terpilih. */
export function FormFitur({
  aksi,
  nama,
  deskripsi,
  aktif,
  semuaKelompok,
  terpilih,
  kelompok,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  semuaKelompok: boolean;
  terpilih: string[];
  kelompok: Kelompok[];
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [cakupan, setCakupan] = useState(semuaKelompok ? "semua" : "pilih");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{nama}</p>
          {deskripsi && <p className="text-sm text-muted">{deskripsi}</p>}
        </div>
        <Saklar name="aktif" label={`Nyalakan ${nama}`} defaultChecked={aktif} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Cakupan {nama}</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { nilai: "semua", label: "Semua kelompok" },
            { nilai: "pilih", label: "Kelompok tertentu" },
          ].map((o) => (
            <label
              key={o.nilai}
              className={`cursor-pointer rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                cakupan === o.nilai ? "bg-primary-soft text-primary" : "bg-surface-muted text-fg"
              }`}
            >
              <input
                type="radio"
                name="cakupan"
                value={o.nilai}
                checked={cakupan === o.nilai}
                onChange={() => setCakupan(o.nilai)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
        {cakupan === "pilih" && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {kelompok.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="kelompok"
                  value={k.id}
                  defaultChecked={terpilih.includes(k.id)}
                  className="size-4 accent-primary"
                />
                {k.nama}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-9 px-4")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
