"use client";

import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { buatPengumuman } from "@/lib/sistem/actions";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import type { StateAksi } from "@/lib/pengaturan/actions";

/**
 * Pengumuman baru. Di Pengaturan: pilih sasaran (admin/generus/semua). Di
 * Kegiatan: khusus generus, pilih wilayah (`wilayah` diisi).
 */
export function FormPengumuman({
  aksi = buatPengumuman,
  pilihSasaran = false,
  wilayah,
}: {
  aksi?: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  pilihSasaran?: boolean;
  wilayah?: { nilai: string; nama: string }[];
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);

  return (
    // key: kosongkan form setelah berhasil.
    <form key={state.pesan} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pesan</span>
        <textarea
          name="pesan"
          required
          rows={2}
          maxLength={300}
          placeholder={
            wilayah
              ? "Mis. Kamis ini pengajian desa pindah ke masjid Al-Ikhlas, jangan lupa bawa Qur'an ya."
              : "Mis. Nanti malam pukul 21.00 ada perawatan singkat ±15 menit."
          }
          className={`${INPUT_CLASS} h-auto py-3`}
        />
      </label>
      {(pilihSasaran || wilayah) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {pilihSasaran && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Untuk</span>
              <select name="sasaran" defaultValue="admin" className={INPUT_CLASS}>
                <option value="admin">Admin saja</option>
                <option value="generus">Generus saja (seluruh desa)</option>
                <option value="semua">Admin & generus</option>
              </select>
            </label>
          )}
          {wilayah && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Untuk generus di</span>
              <select name="wilayah" defaultValue={wilayah[0]?.nilai} className={INPUT_CLASS}>
                {wilayah.map((w) => (
                  <option key={w.nilai} value={w.nilai}>
                    {w.nama}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Jenis</span>
          <select name="nada" defaultValue="info" className={INPUT_CLASS}>
            <option value="info">Info (biru)</option>
            <option value="peringatan">Peringatan (kuning)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Mulai (WIB, opsional)</span>
          <input type="datetime-local" name="mulai" className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Berakhir (WIB, opsional)</span>
          <input type="datetime-local" name="berakhir" className={INPUT_CLASS} />
        </label>
      </div>
      <p className="text-xs text-muted">Mulai kosong = tayang sekarang. Berakhir kosong = tayang sampai disembunyikan.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Buat pengumuman"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
