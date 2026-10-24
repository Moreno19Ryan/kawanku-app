"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { TargetKegiatan } from "@/lib/kegiatan/akses";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { EditorJadwal, type BarisJadwal } from "./editor-jadwal";
import { PengaturanAbsensi } from "./pengaturan-absensi";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
const LABEL = "text-sm font-medium";

/** Buat kegiatan rutin (berjadwal) atau agenda sekali jalan. */
export function FormBuatKegiatan({ aksi, target }: { aksi: Aksi; target: TargetKegiatan[] }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [jenis, setJenis] = useState<"rutin" | "agenda">("rutin");
  const [wilayah, setWilayah] = useState(target[0]?.nilai ?? "");
  const pilih = target.find((t) => t.nilai === wilayah);
  const pilihanWilayah = jenis === "agenda" ? target.filter((t) => t.nilai !== "serentak") : target;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="flex gap-2 sm:col-span-2" role="radiogroup" aria-label="Jenis kegiatan">
        {(["rutin", "agenda"] as const).map((j) => (
          <label
            key={j}
            className={`flex-1 cursor-pointer rounded-card border px-4 py-3 text-sm transition-colors ${
              jenis === j ? "border-primary bg-primary-soft text-primary" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="jenis"
              value={j}
              checked={jenis === j}
              onChange={() => {
                setJenis(j);
                if (j === "agenda" && wilayah === "serentak") setWilayah(pilihanWilayah.find((t) => t.nilai !== "serentak")?.nilai ?? "");
              }}
              className="sr-only"
            />
            <span className="block font-semibold">{j === "rutin" ? "Rutin berjadwal" : "Agenda sekali"}</span>
            <span className="block text-xs text-muted">
              {j === "rutin" ? "Mis. pengajian tiap Minggu & Selasa" : "Mis. kerja bakti, rapat, acara"}
            </span>
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>Nama kegiatan</span>
        <input name="nama" required maxLength={120} placeholder="mis. Pengajian Caberawit" className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Wilayah</span>
        <select name="wilayah" value={wilayah} onChange={(e) => setWilayah(e.target.value)} className={INPUT_CLASS}>
          {pilihanWilayah.map((t) => (
            <option key={t.nilai} value={t.nilai}>
              {t.nama}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Peserta</span>
        {pilih?.umum === false ? (
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

      {jenis === "rutin" ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={LABEL}>Jadwal</span>
          <EditorJadwal awal={[{ hari: 0, jam: "20:00", kecuali_pekan_ke: [] }]} />
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Tanggal & jam</span>
          <input type="datetime-local" name="mulai" required className={INPUT_CLASS} />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Durasi (menit)</span>
        <input type="number" name="durasi" min={15} max={720} defaultValue={90} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>
          Lokasi <span className="font-normal text-muted">(opsional)</span>
        </span>
        <input name="lokasi" maxLength={120} placeholder="mis. Masjid Kelompok 1" className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>
          Keterangan <span className="font-normal text-muted">(opsional)</span>
        </span>
        <textarea name="keterangan" maxLength={500} rows={2} className={`${INPUT_CLASS} h-auto py-3`} />
      </label>
      <PengaturanAbsensi className="sm:col-span-2" />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Buat kegiatan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

export function FormUbahKegiatan({
  aksi,
  awal,
}: {
  aksi: Aksi;
  awal: {
    nama: string;
    lokasi: string | null;
    keterangan: string | null;
    durasi_menit: number;
    aktif: boolean;
    absensi_otomatis: boolean;
    buka_sebelum_menit: number;
    tutup_setelah_menit: number;
  };
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>Nama kegiatan</span>
        <input name="nama" required maxLength={120} defaultValue={awal.nama} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Durasi (menit)</span>
        <input type="number" name="durasi" min={15} max={720} defaultValue={awal.durasi_menit} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Lokasi</span>
        <input name="lokasi" maxLength={120} defaultValue={awal.lokasi ?? ""} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>Keterangan</span>
        <textarea name="keterangan" maxLength={500} rows={2} defaultValue={awal.keterangan ?? ""} className={`${INPUT_CLASS} h-auto py-3`} />
      </label>
      <PengaturanAbsensi className="sm:col-span-2" awal={awal} />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="aktif" defaultChecked={awal.aktif} className="size-4" />
        Aktif (nonaktif = tidak muncul lagi di kalender)
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

export function FormJadwal({ aksi, awal }: { aksi: Aksi; awal: BarisJadwal[] }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <EditorJadwal awal={awal} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Simpan jadwal"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
