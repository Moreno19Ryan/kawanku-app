"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { Saklar } from "@/components/ui/saklar";
import { simpanJadwalCadangan } from "@/lib/sistem/cadangan-actions";

export type JadwalCadangan = { jenis: "harian" | "mingguan" | "bulanan" | "tahunan"; aktif: boolean; simpan: number };

const KETERANGAN: Record<JadwalCadangan["jenis"], { judul: string; kapan: string }> = {
  harian: { judul: "Harian", kapan: "Setiap hari, 02.00 WIB" },
  mingguan: { judul: "Mingguan", kapan: "Setiap Ahad, 02.00 WIB" },
  bulanan: { judul: "Bulanan", kapan: "Setiap tanggal 1, 02.00 WIB (+ pemeriksaan cadangan)" },
  tahunan: { judul: "Tahunan", kapan: "Setiap 1 Januari, 02.00 WIB" },
};

/** Nyala/mati tiap jadwal cadangan & berapa yang disimpan (rotasi). */
export function FormJadwalCadangan({ jadwal }: { jadwal: JadwalCadangan[] }) {
  const [state, onSubmit, pending] = useFormAksi(simpanJadwalCadangan);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {jadwal.map((j) => (
          <li key={j.jenis} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
            <Saklar name={`aktif_${j.jenis}`} label={`Cadangan ${KETERANGAN[j.jenis].judul}`} defaultChecked={j.aktif} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{KETERANGAN[j.jenis].judul}</p>
              <p className="text-sm text-muted">{KETERANGAN[j.jenis].kapan}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              Simpan
              <input
                type="number"
                name={`simpan_${j.jenis}`}
                min={1}
                max={60}
                defaultValue={j.simpan}
                className={`${INPUT_CLASS} h-10 w-20 py-0 text-center`}
              />
              terakhir
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Simpan jadwal"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
