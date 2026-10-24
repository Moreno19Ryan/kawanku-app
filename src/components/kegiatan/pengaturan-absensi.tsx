"use client";

import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/input";

const MENIT = [15, 30, 45, 60];
const LABEL = "text-sm font-medium";

/**
 * Pilihan buka/tutup absensi (field: absensi, buka_sebelum, tutup_setelah;
 * dibaca bacaPengaturanAbsensi). Otomatis = scan diterima N menit sebelum
 * mulai s.d. N menit setelah selesai; manual = admin yang membuka & menutup.
 */
export function PengaturanAbsensi({
  awal = { absensi_otomatis: true, buka_sebelum_menit: 30, tutup_setelah_menit: 30 },
  className = "",
}: {
  awal?: { absensi_otomatis: boolean; buka_sebelum_menit: number; tutup_setelah_menit: number };
  className?: string;
}) {
  const [otomatis, setOtomatis] = useState(awal.absensi_otomatis);
  return (
    <fieldset className={`flex flex-col gap-3 ${className}`}>
      <legend className={`${LABEL} mb-1.5`}>Buka & tutup absensi</legend>
      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Buka & tutup absensi">
        {[
          { nilai: true, judul: "Otomatis", isi: "Dibuka & ditutup sendiri sesuai jam kegiatan" },
          { nilai: false, judul: "Manual", isi: "Admin yang menekan Buka dan Tutup" },
        ].map((p) => (
          <label
            key={p.judul}
            className={`flex-1 cursor-pointer rounded-card border px-4 py-3 text-sm transition-colors ${
              otomatis === p.nilai ? "border-primary bg-primary-soft text-primary" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="absensi"
              value={p.nilai ? "otomatis" : "manual"}
              checked={otomatis === p.nilai}
              onChange={() => setOtomatis(p.nilai)}
              className="sr-only"
            />
            <span className="block font-semibold">{p.judul}</span>
            <span className="block text-xs text-muted">{p.isi}</span>
          </label>
        ))}
      </div>
      {otomatis ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Dibuka</span>
            <select name="buka_sebelum" defaultValue={String(awal.buka_sebelum_menit)} className={INPUT_CLASS}>
              {MENIT.map((m) => (
                <option key={m} value={m}>
                  {m} menit sebelum mulai
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Ditutup</span>
            <select name="tutup_setelah" defaultValue={String(awal.tutup_setelah_menit)} className={INPUT_CLASS}>
              {MENIT.map((m) => (
                <option key={m} value={m}>
                  {m} menit setelah selesai
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="buka_sebelum" value={awal.buka_sebelum_menit} />
          <input type="hidden" name="tutup_setelah" value={awal.tutup_setelah_menit} />
          <p className="text-sm text-muted">
            Absensi langsung dibuka saat admin menekan Buka absensi, dan tetap terbuka sampai admin menekan Tutup.
          </p>
        </>
      )}
      <p className="text-xs text-muted">
        Admin tetap bisa Buka sekarang / Tutup sekarang dari halaman absensi. Koreksi hadir/izin/sakit bisa kapan saja.
      </p>
    </fieldset>
  );
}
