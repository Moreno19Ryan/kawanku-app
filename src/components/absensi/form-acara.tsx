"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { TargetSesi } from "@/lib/absensi/akses";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

const LABEL = "text-sm font-medium";

/**
 * Acara di luar jadwal: tersimpan sebagai agenda sekali di Kegiatan dan
 * langsung dibuka absensinya (lihat buatAcara).
 */
export function FormAcara({ aksi, target, mulaiAwal }: { aksi: Aksi; target: TargetSesi[]; mulaiAwal: string }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [wilayah, setWilayah] = useState(target[0] ? (target[0].kelompokId ?? "desa") : "");
  const dipilih = target.find((t) => (t.kelompokId ?? "desa") === wilayah);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>Nama acara</span>
        <input name="nama" required maxLength={120} placeholder="mis. Kerja bakti masjid" className={INPUT_CLASS} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Wilayah</span>
        <select
          name="wilayah"
          required
          value={wilayah}
          onChange={(e) => setWilayah(e.target.value)}
          className={INPUT_CLASS}
        >
          {target.map((t) => (
            <option key={t.kelompokId ?? "desa"} value={t.kelompokId ?? "desa"}>
              {t.nama}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Peserta</span>
        {dipilih?.umum === false ? (
          <>
            <input type="hidden" name="sasaran" value="generus" />
            <span className={`${INPUT_CLASS} flex items-center text-muted`}>Generus saja</span>
          </>
        ) : (
          <select name="sasaran" defaultValue="semua" className={INPUT_CLASS}>
            <option value="semua">Semua jamaah</option>
            <option value="generus">Generus saja</option>
          </select>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Mulai</span>
        <input type="datetime-local" name="mulai" required defaultValue={mulaiAwal} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Lama acara</span>
        <select name="durasi" defaultValue="90" className={INPUT_CLASS}>
          {[30, 60, 90, 120, 180, 240].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} menit` : `${m / 60} jam`.replace(".5", ",5")}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyiapkan…" : "Buat acara & buka absensi"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
