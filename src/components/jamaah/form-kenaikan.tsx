"use client";

import { useState, type FormEvent } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { aksiBawaan, pilihanAksi } from "@/lib/jamaah/kenaikan";
import { labelSekolah } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Baris = { id: string; nama_lengkap: string; kode: string; status_sekolah: string; kelas: number | null; usia: number | null };

/** Daftar kenaikan kelas: satu pilihan per jamaah, diterapkan sekaligus. */
export function FormKenaikan({
  aksi,
  baris,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  baris: Baris[];
}) {
  const [pilih, setPilih] = useState<Record<string, string>>(() =>
    Object.fromEntries(baris.map((b) => [b.id, aksiBawaan(b.kelas)])),
  );
  const nilai = (b: Baris) => pilih[b.id] ?? aksiBawaan(b.kelas);
  const berubah = baris.filter((b) => nilai(b) !== "lewati").length;
  const belum = baris.filter((b) => nilai(b) === "lewati" && (b.kelas === null || b.kelas === 12)).length;
  const [state, onSubmit, pending] = useFormAksi(aksi, () =>
    window.confirm(`Terapkan perubahan untuk ${berubah} jamaah? Kategori jamaah ikut menyesuaikan otomatis.`),
  );

  function onChange(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLSelectElement;
    if (t.name.startsWith("aksi:")) setPilih((p) => ({ ...p, [t.name.slice(5)]: t.value }));
  }

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {baris.map((b) => {
          const perluPilih = nilai(b) === "lewati" && (b.kelas === null || b.kelas === 12);
          return (
            <li key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.nama_lengkap}</p>
                <p className="text-xs text-muted">
                  {b.kelas === null ? (
                    <span className="text-danger">{labelSekolah(b.status_sekolah, null)} · kelas belum diisi</span>
                  ) : (
                    labelSekolah(b.status_sekolah, b.kelas)
                  )}
                  {b.usia !== null && ` · ${b.usia} tahun`}
                </p>
              </div>
              <select
                name={`aksi:${b.id}`}
                aria-label={`Hasil untuk ${b.nama_lengkap}`}
                defaultValue={aksiBawaan(b.kelas)}
                className={`${INPUT_CLASS} sm:w-64 ${perluPilih ? "ring-2 ring-warning/60" : ""}`}
              >
                {pilihanAksi(b.status_sekolah, b.kelas).map((p) => (
                  <option key={p.nilai} value={p.nilai}>
                    {p.label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-[calc(var(--spacing-bottomnav)+0.5rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-lg ring-1 ring-border lg:bottom-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{berubah}</span> akan diperbarui
          {belum > 0 && <> · {belum} belum dipilih (dilewati)</>}
        </p>
        <button type="submit" disabled={pending || berubah === 0} className={buttonClass("utama")}>
          {pending ? "Menerapkan…" : "Terapkan"}
        </button>
        <PesanAksi state={state} className="w-full" />
      </div>
    </form>
  );
}
