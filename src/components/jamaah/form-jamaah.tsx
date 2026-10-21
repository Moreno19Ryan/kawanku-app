"use client";

import { useState, type FormEvent } from "react";
import { Tags } from "lucide-react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { cariKategori, hitungUsia, type AturanKategori } from "@/lib/jamaah/kategori";
import { Saklar } from "@/components/ui/saklar";
import {
  LABEL_PENDIDIKAN,
  LABEL_STATUS_PERNIKAHAN,
  LABEL_STATUS_SEKOLAH,
  PAKET_CABERAWIT,
  RENTANG_KELAS,
  labelJenisMuballigh,
  labelMuballigh,
} from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

export type NilaiJamaah = {
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: string;
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  status_pernikahan: string | null;
  status_sekolah: string | null;
  kelas: number | null;
  kelompok_id: string;
  tempat_lahir: string | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  muballigh: boolean;
  jenis_muballigh: string | null;
  paket_caberawit: string | null;
};

type Pratinjau = Pick<
  NilaiJamaah,
  "tanggal_lahir" | "tahun_lahir" | "status_pernikahan" | "status_sekolah" | "jenis_kelamin" | "muballigh"
>;

/** Status sekolah yang biasanya kategori Caberawit (paket A–F). */
const SEKOLAH_CABERAWIT = ["belum_sekolah", "paud_tk", "sd"];

function Wajib() {
  return (
    <span className="text-danger" aria-hidden>
      {" "}
      *
    </span>
  );
}

function Kolom({
  label,
  children,
  bantuan,
  wajib,
}: {
  label: string;
  children: React.ReactNode;
  bantuan?: string;
  wajib?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {wajib && <Wajib />}
      </span>
      {children}
      {bantuan && <span className="text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

/** Form profil jamaah (tambah atau ubah), dengan pratinjau kategori. */
export function FormJamaah({
  aksi,
  nilai,
  kelompok,
  aturan,
  labelKirim,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  nilai?: NilaiJamaah;
  kelompok: { id: string; nama: string }[];
  aturan: AturanKategori[];
  labelKirim: string;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [p, setP] = useState<Pratinjau>({
    tanggal_lahir: nilai?.tanggal_lahir ?? null,
    tahun_lahir: nilai?.tahun_lahir ?? null,
    status_pernikahan: nilai?.status_pernikahan ?? null,
    status_sekolah: nilai?.status_sekolah ?? null,
    jenis_kelamin: nilai?.jenis_kelamin ?? "",
    muballigh: nilai?.muballigh ?? false,
  });

  function onChange(e: FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget);
    const ambil = (n: string) => String(f.get(n) ?? "") || null;
    const tahun = Number(ambil("tahun_lahir"));
    setP({
      tanggal_lahir: ambil("tanggal_lahir"),
      tahun_lahir: Number.isInteger(tahun) && tahun > 1900 ? tahun : null,
      status_pernikahan: ambil("status_pernikahan"),
      status_sekolah: ambil("status_sekolah"),
      jenis_kelamin: ambil("jenis_kelamin") ?? "",
      muballigh: f.get("muballigh") === "on",
    });
  }

  const usia = hitungUsia(p.tanggal_lahir, p.tanggal_lahir ? null : p.tahun_lahir);
  const kategori = cariKategori(aturan, usia, p.status_pernikahan, p.status_sekolah);

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Kolom label="Nama lengkap" wajib>
          <input
            name="nama_lengkap"
            required
            maxLength={120}
            autoComplete="off"
            defaultValue={nilai?.nama_lengkap}
            className={INPUT_CLASS}
          />
        </Kolom>
        <Kolom label="Nama panggilan (opsional)">
          <input
            name="nama_panggilan"
            maxLength={40}
            autoComplete="off"
            defaultValue={nilai?.nama_panggilan ?? ""}
            className={INPUT_CLASS}
          />
        </Kolom>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Jenis kelamin
          <Wajib />
        </legend>
        <div className="flex gap-2">
          {[
            { nilai: "L", label: "Laki-laki" },
            { nilai: "P", label: "Perempuan" },
          ].map((o) => (
            <label key={o.nilai} className="cursor-pointer">
              <input
                type="radio"
                name="jenis_kelamin"
                value={o.nilai}
                required
                defaultChecked={nilai?.jenis_kelamin === o.nilai}
                className="peer sr-only"
              />
              <span className="inline-flex rounded-pill bg-surface-muted px-4 py-2 text-sm font-medium transition-colors duration-200 ease-oneui peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="Tanggal lahir" wajib bantuan="Bila tidak tahu, kosongkan dan isi tahun lahir saja.">
          <input
            type="date"
            name="tanggal_lahir"
            defaultValue={nilai?.tanggal_lahir ?? ""}
            className={INPUT_CLASS}
          />
        </Kolom>
        <Kolom
          label="Tahun lahir"
          bantuan={p.tanggal_lahir ? "Diambil dari tanggal lahir." : "Dipakai bila tanggal lahir kosong."}
        >
          <input
            type="number"
            name="tahun_lahir"
            inputMode="numeric"
            min={1901}
            max={2100}
            disabled={Boolean(p.tanggal_lahir)}
            required={!p.tanggal_lahir}
            defaultValue={nilai?.tanggal_lahir ? "" : (nilai?.tahun_lahir ?? "")}
            placeholder={p.tanggal_lahir ? p.tanggal_lahir.slice(0, 4) : "Mis. 2010"}
            className={INPUT_CLASS}
          />
        </Kolom>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kolom label="Status sekolah/kegiatan" wajib>
          <select
            name="status_sekolah"
            required
            defaultValue={nilai?.status_sekolah ?? ""}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              Pilih…
            </option>
            {Object.entries(LABEL_STATUS_SEKOLAH).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Kolom>
        {RENTANG_KELAS[p.status_sekolah ?? ""] && (
          <Kolom label="Kelas" bantuan="Dinaikkan otomatis tiap tahun ajaran lewat Kenaikan kelas.">
            <select
              key={p.status_sekolah}
              name="kelas"
              defaultValue={nilai?.status_sekolah === p.status_sekolah ? (nilai?.kelas ?? "") : ""}
              className={INPUT_CLASS}
            >
              <option value="">Belum tahu</option>
              {Array.from(
                { length: RENTANG_KELAS[p.status_sekolah!][1] - RENTANG_KELAS[p.status_sekolah!][0] + 1 },
                (_, i) => RENTANG_KELAS[p.status_sekolah!][0] + i,
              ).map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </Kolom>
        )}
        <Kolom label="Status pernikahan" wajib>
          <select
            name="status_pernikahan"
            required
            defaultValue={nilai?.status_pernikahan ?? ""}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              Pilih…
            </option>
            {Object.entries(LABEL_STATUS_PERNIKAHAN).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Kolom>
        <Kolom label="Kelompok" wajib>
          <select
            name="kelompok_id"
            required
            defaultValue={nilai?.kelompok_id ?? (kelompok.length === 1 ? kelompok[0].id : "")}
            className={INPUT_CLASS}
          >
            {kelompok.length > 1 && <option value="">Pilih kelompok</option>}
            {kelompok.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </Kolom>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-control bg-surface-muted p-4 text-sm"
      >
        <Tags className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p>
          {kategori ? (
            <>
              Kategori: <span className="font-semibold">{kategori.nama}</span>
              {kategori.termasuk_generus && <span className="text-primary"> · Generus</span>}
            </>
          ) : (
            <span className="text-muted">
              Belum masuk kategori mana pun. Lengkapi status sekolah, status pernikahan, atau usia.
            </span>
          )}
          {usia !== null && <span className="text-muted"> · {usia} tahun</span>}
        </p>
      </div>

      <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
        <legend className="sr-only">Data tambahan (opsional)</legend>
        <p className="text-sm font-semibold">Data tambahan (opsional)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Kolom label="Tempat lahir">
            <input
              name="tempat_lahir"
              maxLength={80}
              defaultValue={nilai?.tempat_lahir ?? ""}
              placeholder="Mis. Bekasi"
              className={INPUT_CLASS}
            />
          </Kolom>
          <Kolom label="Pendidikan terakhir">
            <select
              name="pendidikan_terakhir"
              defaultValue={nilai?.pendidikan_terakhir ?? ""}
              className={INPUT_CLASS}
            >
              <option value="">Belum diisi</option>
              {Object.entries(LABEL_PENDIDIKAN).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Kolom>
          <Kolom label="Pekerjaan / kegiatan" bantuan="Mis. Karyawan swasta, Wirausaha, Mondok.">
            <input
              name="kegiatan"
              maxLength={120}
              defaultValue={nilai?.kegiatan ?? ""}
              className={INPUT_CLASS}
            />
          </Kolom>
        </div>

        {(SEKOLAH_CABERAWIT.includes(p.status_sekolah ?? "") || nilai?.paket_caberawit) && (
          <Kolom label="Paket caberawit" bantuan="Untuk jamaah kategori Caberawit.">
            <select
              name="paket_caberawit"
              defaultValue={nilai?.paket_caberawit ?? ""}
              className={`${INPUT_CLASS} sm:max-w-xs`}
            >
              <option value="">Belum diisi</option>
              {PAKET_CABERAWIT.map((k) => (
                <option key={k} value={k}>
                  Paket {k}
                </option>
              ))}
            </select>
          </Kolom>
        )}

        <div className="flex flex-col gap-3 rounded-control bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{labelMuballigh(p.jenis_kelamin)}</p>
              <p className="text-xs text-muted">Nyalakan bila jamaah ini sudah berstatus {labelMuballigh(p.jenis_kelamin).toLowerCase()}.</p>
            </div>
            <Saklar name="muballigh" label={labelMuballigh(p.jenis_kelamin)} defaultChecked={nilai?.muballigh} />
          </div>
          {p.muballigh && (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-medium">Penugasan</legend>
              {[
                { nilai: "", label: "Belum dipilih" },
                { nilai: "tugasan", label: labelJenisMuballigh("tugasan", p.jenis_kelamin) },
                { nilai: "setempat", label: labelJenisMuballigh("setempat", p.jenis_kelamin) },
              ].map((o) => (
                <label key={o.nilai} className="cursor-pointer">
                  <input
                    type="radio"
                    name="jenis_muballigh"
                    value={o.nilai}
                    defaultChecked={(nilai?.jenis_muballigh ?? "") === o.nilai}
                    className="peer sr-only"
                  />
                  <span className="inline-flex rounded-pill bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-oneui peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                    {o.label}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </fieldset>

      <p className="text-xs text-muted">
        <span className="text-danger">*</span> wajib diisi. Kontak, alamat, dan data pribadi lain
        diisi di halaman detail jamaah setelah disimpan.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : labelKirim}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
