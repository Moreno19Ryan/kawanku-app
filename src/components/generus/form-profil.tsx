"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { kirimUsulanKoreksi, simpanDataDiri } from "@/lib/generus/actions";
import { formatNoHp } from "@/lib/jamaah/format";
import { BAGIAN_LAPOR_GENERUS, bagianTerstruktur } from "@/lib/jamaah/usulan-nilai";
import {
  LABEL_BAGIAN_USULAN,
  LABEL_PENDIDIKAN,
  LABEL_STATUS_PERNIKAHAN,
  LABEL_STATUS_SEKOLAH,
  RENTANG_KELAS,
} from "@/lib/label";

function Kolom({ label, children, bantuan }: { label: string; children: React.ReactNode; bantuan?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {bantuan && <span className="text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

export type NilaiDataDiri = {
  nama_panggilan: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  status_sekolah: string | null;
  kelas: number | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  no_hp: string | null;
  email: string | null;
  no_hp_wali: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
};

function Judul({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-muted">{children}</h3>;
}

/**
 * Data diri yang diubah generus sendiri: langsung tersimpan (tercatat di
 * jejak perubahan untuk admin). Perubahan yang membuatnya keluar dari
 * generus ditolak server.
 */
export function FormDataDiri({ nilai, hariIni }: { nilai: NilaiDataDiri; hariIni: string }) {
  const [state, onSubmit, pending] = useFormAksi(simpanDataDiri);
  const [sekolah, setSekolah] = useState(nilai.status_sekolah ?? "");
  const rentang = RENTANG_KELAS[sekolah];
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Judul>Sapaan & kelahiran</Judul>
        <Kolom label="Nama panggilan" bantuan="Dipakai untuk menyapamu di aplikasi.">
          <input name="nama_panggilan" maxLength={40} defaultValue={nilai.nama_panggilan ?? ""} className={INPUT_CLASS} />
        </Kolom>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Tempat lahir">
            <input name="tempat_lahir" maxLength={80} defaultValue={nilai.tempat_lahir ?? ""} className={INPUT_CLASS} />
          </Kolom>
          <Kolom label="Tanggal lahir">
            <input
              name="tanggal_lahir"
              type="date"
              max={hariIni}
              required={Boolean(nilai.tanggal_lahir)}
              defaultValue={nilai.tanggal_lahir ?? ""}
              className={INPUT_CLASS}
            />
          </Kolom>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Judul>Sekolah & kegiatan</Judul>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Status sekolah">
            <select
              name="status_sekolah"
              required={Boolean(nilai.status_sekolah)}
              value={sekolah}
              onChange={(e) => setSekolah(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Pilih…
              </option>
              {Object.entries(LABEL_STATUS_SEKOLAH).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Kolom>
          {rentang && (
            <Kolom label="Kelas">
              <select
                name="kelas"
                defaultValue={nilai.kelas && nilai.kelas >= rentang[0] && nilai.kelas <= rentang[1] ? nilai.kelas : ""}
                className={INPUT_CLASS}
              >
                <option value="">Belum diisi</option>
                {Array.from({ length: rentang[1] - rentang[0] + 1 }, (_, i) => rentang[0] + i).map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </Kolom>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Pendidikan terakhir" bantuan="Jenjang terakhir yang sudah lulus.">
            <select name="pendidikan_terakhir" defaultValue={nilai.pendidikan_terakhir ?? ""} className={INPUT_CLASS}>
              <option value="">Belum diisi</option>
              {Object.entries(LABEL_PENDIDIKAN).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Kolom>
          <Kolom label="Pekerjaan / kegiatan" bantuan="Mis. Pelajar, Mondok, Karyawan swasta.">
            <input name="kegiatan" maxLength={120} defaultValue={nilai.kegiatan ?? ""} className={INPUT_CLASS} />
          </Kolom>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Judul>Kontak</Judul>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="No. HP/WhatsApp">
            <input
              name="no_hp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={formatNoHp(nilai.no_hp)}
              placeholder="08xx-xxxx-xxxx"
              className={INPUT_CLASS}
            />
          </Kolom>
          <Kolom label="Email">
            <input
              name="email"
              type="email"
              maxLength={120}
              autoComplete="email"
              defaultValue={nilai.email ?? ""}
              className={INPUT_CLASS}
            />
          </Kolom>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Judul>Orang tua / wali</Judul>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Nama ayah">
            <input name="nama_ayah" maxLength={120} defaultValue={nilai.nama_ayah ?? ""} className={INPUT_CLASS} />
          </Kolom>
          <Kolom label="Nama ibu">
            <input name="nama_ibu" maxLength={120} defaultValue={nilai.nama_ibu ?? ""} className={INPUT_CLASS} />
          </Kolom>
        </div>
        <Kolom label="No. HP orang tua/wali" bantuan="Dihubungi pengurus bila perlu.">
          <input
            name="no_hp_wali"
            type="tel"
            inputMode="tel"
            defaultValue={formatNoHp(nilai.no_hp_wali)}
            placeholder="08xx-xxxx-xxxx"
            className={INPUT_CLASS}
          />
        </Kolom>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama", "h-11 px-6")}>
          {pending ? "Menyimpan…" : "Simpan data diri"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

/** Lapor data yang hanya bisa diubah admin (nama lengkap, status pernikahan, dll.). */
export function FormUsulanKoreksi() {
  const [state, onSubmit, pending] = useFormAksi(kirimUsulanKoreksi);
  // Terkirim → form dipasang ulang (isian kosong); ditolak server → isian tetap.
  return <IsiUsulan key={state.pesan ?? "baru"} state={state} onSubmit={onSubmit} pending={pending} />;
}

function IsiUsulan({
  state,
  onSubmit,
  pending,
}: {
  state: ReturnType<typeof useFormAksi>[0];
  onSubmit: ReturnType<typeof useFormAksi>[1];
  pending: boolean;
}) {
  const [bagian, setBagian] = useState("");
  const terstruktur = bagianTerstruktur(bagian);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Kolom label="Data yang salah">
        <select
          name="bagian"
          required
          value={bagian}
          onChange={(e) => setBagian(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="" disabled>
            Pilih…
          </option>
          {BAGIAN_LAPOR_GENERUS.map((k) => (
            <option key={k} value={k}>
              {LABEL_BAGIAN_USULAN[k]}
            </option>
          ))}
        </select>
      </Kolom>

      {bagian === "status_pernikahan" && (
        <Kolom label="Yang benar">
          <select name="nilai" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>
              Pilih…
            </option>
            {Object.entries(LABEL_STATUS_PERNIKAHAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Kolom>
      )}
      <Kolom
        label={terstruktur ? "Keterangan (opsional)" : "Seharusnya"}
        bantuan={
          terstruktur
            ? "Mis. “Sudah menikah sejak Agustus”."
            : "Tulis data yang benar, mis. “Nama lengkap: Muhammad Fajar Ramadhan”."
        }
      >
        <textarea
          name="isi"
          required={!terstruktur}
          maxLength={300}
          rows={3}
          className={`${INPUT_CLASS} h-auto py-3`}
        />
      </Kolom>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10 px-5")}>
          {pending ? "Mengirim…" : "Kirim ke admin"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
