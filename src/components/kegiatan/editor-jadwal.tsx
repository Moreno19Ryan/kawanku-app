"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type BarisJadwal = { hari: number; jam: string; kecuali_pekan_ke: number[] };

/**
 * Editor aturan jadwal rutin: tiap baris = hari + jam + pekan libur
 * (mis. Minggu 20:00, libur pekan ke-3). Nama field: hari_i, jam_i, libur_i.
 */
export function EditorJadwal({ awal }: { awal?: BarisJadwal[] }) {
  const [baris, setBaris] = useState<BarisJadwal[]>(awal?.length ? awal : [{ hari: 0, jam: "20:00", kecuali_pekan_ke: [] }]);

  return (
    <div className="flex flex-col gap-3">
      {baris.map((b, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-card bg-surface-muted/60 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            name={`hari_${i}`}
            defaultValue={b.hari}
            aria-label="Hari"
            className={`${INPUT_CLASS} h-10 py-0 text-sm sm:w-36`}
          >
            {HARI.map((h, n) => (
              <option key={h} value={n}>
                {h}
              </option>
            ))}
          </select>
          <input
            type="time"
            name={`jam_${i}`}
            defaultValue={b.jam.slice(0, 5)}
            required
            aria-label="Jam"
            className={`${INPUT_CLASS} h-10 py-0 text-sm sm:w-32`}
          />
          <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <legend className="sr-only">Pekan libur</legend>
            <span className="text-muted">Libur pekan ke-</span>
            {[1, 2, 3, 4, 5].map((p) => (
              <label key={p} className="flex items-center gap-1">
                <input type="checkbox" name={`libur_${i}`} value={p} defaultChecked={b.kecuali_pekan_ke.includes(p)} className="size-4" />
                {p}
              </label>
            ))}
          </fieldset>
          {baris.length > 1 && (
            <button
              type="button"
              onClick={() => setBaris(baris.filter((_, n) => n !== i))}
              aria-label="Hapus baris jadwal"
              className="ml-auto flex size-9 items-center justify-center rounded-pill text-muted hover:bg-border"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ))}
      {baris.length < 7 && (
        <button
          type="button"
          onClick={() => setBaris([...baris, { hari: 2, jam: "20:00", kecuali_pekan_ke: [] }])}
          className={buttonClass("netral", "h-9 self-start px-4")}
        >
          <Plus className="size-4" aria-hidden />
          Tambah hari
        </button>
      )}
      <p className="text-xs text-muted">
        &ldquo;Libur pekan ke-3&rdquo; pada hari Minggu = Minggu ketiga setiap bulan (tanggal 15–21) tidak ada pertemuan.
      </p>
    </div>
  );
}
