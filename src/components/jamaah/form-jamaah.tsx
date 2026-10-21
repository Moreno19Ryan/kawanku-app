"use client";

import { useState, type FormEvent } from "react";
import { Tags } from "lucide-react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { cariKategori, hitungUsia, type AturanKategori } from "@/lib/jamaah/kategori";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

export type NilaiJamaah = {
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: string;
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  status_pernikahan: string | null;
  status_sekolah: string | null;
  kelompok_id: string;
};

type Pratinjau = Pick<NilaiJamaah, "tanggal_lahir" | "tahun_lahir" | "status_pernikahan" | "status_sekolah">;

function Kolom({ label, children, bantuan }: { label: string; children: React.ReactNode; bantuan?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
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
    });
  }

  const usia = hitungUsia(p.tanggal_lahir, p.tanggal_lahir ? null : p.tahun_lahir);
  const kategori = cariKategori(aturan, usia, p.status_pernikahan, p.status_sekolah);

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Kolom label="Nama lengkap">
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
        <legend className="mb-2 text-sm font-medium">Jenis kelamin</legend>
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
        <Kolom label="Tanggal lahir" bantuan="Kosongkan bila tidak tahu, lalu isi tahun lahir saja.">
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
            defaultValue={nilai?.tanggal_lahir ? "" : (nilai?.tahun_lahir ?? "")}
            placeholder={p.tanggal_lahir ? p.tanggal_lahir.slice(0, 4) : "Mis. 2010"}
            className={INPUT_CLASS}
          />
        </Kolom>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kolom label="Status sekolah">
          <select name="status_sekolah" defaultValue={nilai?.status_sekolah ?? ""} className={INPUT_CLASS}>
            <option value="">Belum diisi</option>
            {Object.entries(LABEL_STATUS_SEKOLAH).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Kolom>
        <Kolom label="Status pernikahan">
          <select
            name="status_pernikahan"
            defaultValue={nilai?.status_pernikahan ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">Belum diisi</option>
            {Object.entries(LABEL_STATUS_PERNIKAHAN).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Kolom>
        <Kolom label="Kelompok">
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

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : labelKirim}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
