"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { kirimUsulanKoreksi, simpanProfilSaya } from "@/lib/generus/actions";
import { formatNoHp } from "@/lib/jamaah/format";
import { bagianTerstruktur } from "@/lib/jamaah/usulan-nilai";
import { LABEL_BAGIAN_USULAN, LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH, RENTANG_KELAS } from "@/lib/label";

function Kolom({ label, children, bantuan }: { label: string; children: React.ReactNode; bantuan?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {bantuan && <span className="text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

/** Nama panggilan, no. HP/WA, email: diubah generus sendiri. */
export function FormProfil({
  nilai,
}: {
  nilai: { nama_panggilan: string | null; no_hp: string | null; email: string | null };
}) {
  const [state, onSubmit, pending] = useFormAksi(simpanProfilSaya);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Kolom label="Nama panggilan" bantuan="Dipakai untuk menyapamu di aplikasi.">
        <input name="nama_panggilan" maxLength={40} defaultValue={nilai.nama_panggilan ?? ""} className={INPUT_CLASS} />
      </Kolom>
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
        <input name="email" type="email" maxLength={120} autoComplete="email" defaultValue={nilai.email ?? ""} className={INPUT_CLASS} />
      </Kolom>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10 px-5")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

/** Lapor data yang salah (nama, tanggal lahir, dll.) ke admin. */
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
  const [sekolah, setSekolah] = useState("");
  const terstruktur = bagianTerstruktur(bagian);
  const rentang = RENTANG_KELAS[sekolah];
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
          {Object.entries(LABEL_BAGIAN_USULAN).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Kolom>

      {bagian === "status_sekolah" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Yang benar">
            <select
              name="nilai"
              required
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
            <Kolom label="Kelas (opsional)">
              <select name="nilai_kelas" defaultValue="" className={INPUT_CLASS}>
                <option value="">Tidak tahu</option>
                {Array.from({ length: rentang[1] - rentang[0] + 1 }, (_, i) => rentang[0] + i).map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </Kolom>
          )}
        </div>
      )}
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
      {bagian === "tanggal_lahir" && (
        <Kolom label="Tanggal lahir yang benar">
          <input name="nilai" type="date" required className={INPUT_CLASS} />
        </Kolom>
      )}

      <Kolom
        label={terstruktur ? "Keterangan (opsional)" : "Seharusnya"}
        bantuan={
          terstruktur
            ? "Mis. “Lulus SMA Juni kemarin, sekarang kuliah di …”."
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
