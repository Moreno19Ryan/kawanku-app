"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { LABEL_HUBUNGAN } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
type Opsi = { id: string; nama: string };

function PilihHubungan({ nilai, className = "" }: { nilai?: string | null; className?: string }) {
  return (
    <select
      name="hubungan"
      required
      defaultValue={nilai ?? ""}
      aria-label="Hubungan dalam keluarga"
      className={`${INPUT_CLASS} ${className}`}
    >
      <option value="" disabled>
        Hubungan…
      </option>
      {Object.entries(LABEL_HUBUNGAN).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Buat keluarga baru: nama + kelompok. */
export function FormBuatKeluarga({ aksi, kelompok }: { aksi: Aksi; kelompok: Opsi[] }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <input
        name="nama"
        required
        maxLength={120}
        placeholder="Nama keluarga, mis. Keluarga Bapak Ahmad"
        aria-label="Nama keluarga"
        className={`${INPUT_CLASS} w-full sm:flex-1`}
      />
      {kelompok.length > 1 ? (
        <select name="kelompok_id" required defaultValue="" aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:w-48`}>
          <option value="" disabled>
            Pilih kelompok
          </option>
          {kelompok.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="kelompok_id" value={kelompok[0]?.id ?? ""} />
      )}
      <button type="submit" disabled={pending} className={buttonClass("utama", "h-12 shrink-0")}>
        {pending ? "Membuat…" : "Buat keluarga"}
      </button>
      <PesanAksi state={state} className="sm:self-center" />
    </form>
  );
}

export function FormNamaKeluarga({ aksi, nama }: { aksi: Aksi; nama: string }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input name="nama" required maxLength={120} defaultValue={nama} aria-label="Nama keluarga" className={`${INPUT_CLASS} w-full sm:flex-1`} />
      <button type="submit" disabled={pending} className={buttonClass("kedua", "h-12 shrink-0")}>
        {pending ? "Menyimpan…" : "Simpan nama"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

/** Tambah anggota: jamaah sekelompok yang belum punya keluarga + hubungannya. */
export function FormTambahAnggota({ aksi, kandidat }: { aksi: Aksi; kandidat: Opsi[] }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  if (kandidat.length === 0) {
    return (
      <p className="text-sm text-muted">
        Semua jamaah di kelompok ini sudah punya keluarga, atau belum ada data jamaah.
      </p>
    );
  }
  return (
    // key: kosongkan pilihan setelah berhasil.
    <form key={state.pesan} onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select name="jamaah_id" required defaultValue="" aria-label="Jamaah" className={`${INPUT_CLASS} w-full sm:flex-1`}>
        <option value="" disabled>
          Pilih jamaah ({kandidat.length} belum berkeluarga)
        </option>
        {kandidat.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
      <PilihHubungan className="w-full sm:w-56" />
      <button type="submit" disabled={pending} className={buttonClass("utama", "h-12 shrink-0")}>
        {pending ? "Menambah…" : "Tambah"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

/** Ubah hubungan satu anggota (dipakai di daftar anggota). */
export function FormHubungan({ aksi, nilai }: { aksi: Aksi; nilai: string | null }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <PilihHubungan nilai={nilai} className="h-10 w-full py-0 text-sm sm:w-52" />
      <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 px-4")}>
        {pending ? "…" : "Simpan"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

/** Dari detail jamaah: masukkan ke keluarga yang sudah ada di kelompoknya. */
export function FormHubungkan({ aksi, keluarga }: { aksi: Aksi; keluarga: Opsi[] }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select name="keluarga_id" required defaultValue="" aria-label="Keluarga" className={`${INPUT_CLASS} w-full sm:flex-1`}>
        <option value="" disabled>
          Pilih keluarga
        </option>
        {keluarga.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
      <PilihHubungan className="w-full sm:w-56" />
      <button type="submit" disabled={pending} className={buttonClass("kedua", "h-12 shrink-0")}>
        {pending ? "Menyimpan…" : "Masukkan"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}
