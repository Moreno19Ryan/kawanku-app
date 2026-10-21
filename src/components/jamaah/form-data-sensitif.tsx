"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { Saklar } from "@/components/ui/saklar";
import { formatNoHp, samarkan } from "@/lib/jamaah/format";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PilihWilayah } from "./pilih-wilayah";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

function Kolom({ label, children, bantuan }: { label: string; children: React.ReactNode; bantuan?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {bantuan && <span className="text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

function Kirim({ pending, state }: { pending: boolean; state: StateAksi }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10 px-5")}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
      <PesanAksi state={state} />
    </div>
  );
}


export function FormKontak({
  aksi,
  nilai,
}: {
  aksi: Aksi;
  nilai: { no_hp: string | null; no_hp_wali: string | null; email: string | null } | null;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kolom label="No. HP/WhatsApp">
          <input name="no_hp" type="tel" inputMode="tel" defaultValue={formatNoHp(nilai?.no_hp ?? null)} placeholder="08xx-xxxx-xxxx" className={INPUT_CLASS} />
        </Kolom>
        <Kolom label="No. HP orang tua/wali">
          <input name="no_hp_wali" type="tel" inputMode="tel" defaultValue={formatNoHp(nilai?.no_hp_wali ?? null)} placeholder="08xx-xxxx-xxxx" className={INPUT_CLASS} />
        </Kolom>
        <Kolom label="Email">
          <input name="email" type="email" maxLength={120} defaultValue={nilai?.email ?? ""} className={INPUT_CLASS} />
        </Kolom>
      </div>
      <Kirim pending={pending} state={state} />
    </form>
  );
}

export type NilaiPribadi = {
  nama_ayah: string | null;
  nama_ibu: string | null;
  ktp_kode_wilayah: string | null;
  ktp_jalan: string | null;
  ktp_rt: number | null;
  ktp_rw: number | null;
  ktp_kode_pos: string | null;
  domisili_sama_ktp: boolean;
  dom_kode_wilayah: string | null;
  dom_jalan: string | null;
  dom_rt: number | null;
  dom_rw: number | null;
  dom_kode_pos: string | null;
};

function IsianAlamat({ awalan, nilai }: { awalan: "ktp" | "dom"; nilai: NilaiPribadi | null }) {
  const v = (k: string) => {
    const x = nilai?.[`${awalan}_${k}` as keyof NilaiPribadi];
    return x === null || x === undefined ? "" : String(x);
  };
  return (
    <div className="flex flex-col gap-3">
      <PilihWilayah name={`${awalan}_kode_wilayah`} awal={v("kode_wilayah") || null} />
      <Kolom label="Jalan / perumahan / blok">
        <input name={`${awalan}_jalan`} maxLength={200} defaultValue={v("jalan")} className={INPUT_CLASS} />
      </Kolom>
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Kolom label="RT">
          <input name={`${awalan}_rt`} inputMode="numeric" maxLength={3} defaultValue={v("rt")} className={INPUT_CLASS} />
        </Kolom>
        <Kolom label="RW">
          <input name={`${awalan}_rw`} inputMode="numeric" maxLength={3} defaultValue={v("rw")} className={INPUT_CLASS} />
        </Kolom>
        <Kolom label="Kode pos">
          <input name={`${awalan}_kode_pos`} inputMode="numeric" maxLength={5} defaultValue={v("kode_pos")} className={INPUT_CLASS} />
        </Kolom>
      </div>
    </div>
  );
}

/** Alamat KTP/KIA + domisili (dengan saklar "sama"); dipakai admin & generus. */
function BagianAlamat({ nilai, dokumen }: { nilai: NilaiPribadi | null; dokumen: "KIA" | "KTP" }) {
  // Belum ada data: anggap domisili sama dengan alamat KTP/KIA (paling umum).
  const [sama, setSama] = useState(nilai ? nilai.domisili_sama_ktp : true);
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">Alamat sesuai {dokumen}</legend>
        <IsianAlamat awalan="ktp" nilai={nilai} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">Alamat saat ini (domisili)</legend>
        <div className="flex items-center justify-between gap-4 rounded-control bg-surface-muted p-4">
          <p className="text-sm font-medium">Sama dengan alamat {dokumen}</p>
          <Saklar
            name="domisili_sama_ktp"
            label={`Sama dengan alamat ${dokumen}`}
            checked={sama}
            onChange={(e) => setSama(e.target.checked)}
          />
        </div>
        {!sama && <IsianAlamat awalan="dom" nilai={nilai} />}
      </fieldset>

      <input type="hidden" name="dokumen" value={dokumen} />
    </>
  );
}

export function FormPribadi({
  aksi,
  nilai,
  dokumen = "KTP",
}: {
  aksi: Aksi;
  nilai: NilaiPribadi | null;
  /** "KIA" untuk anak di bawah 17 tahun. */
  dokumen?: "KIA" | "KTP";
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="Nama ayah kandung">
          <input name="nama_ayah" maxLength={120} defaultValue={nilai?.nama_ayah ?? ""} className={INPUT_CLASS} />
        </Kolom>
        <Kolom label="Nama ibu kandung">
          <input name="nama_ibu" maxLength={120} defaultValue={nilai?.nama_ibu ?? ""} className={INPUT_CLASS} />
        </Kolom>
      </div>
      <BagianAlamat nilai={nilai} dokumen={dokumen} />
      <Kirim pending={pending} state={state} />
    </form>
  );
}

/** Form alamat untuk generus sendiri (tanpa nama orang tua). */
export function FormAlamat({
  aksi,
  nilai,
  dokumen,
}: {
  aksi: Aksi;
  nilai: NilaiPribadi | null;
  dokumen: "KIA" | "KTP";
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <BagianAlamat nilai={nilai} dokumen={dokumen} />
      <Kirim pending={pending} state={state} />
    </form>
  );
}


/** Nomor tersamar dengan tombol tampilkan (hanya di layar, tidak tersimpan). */
export function NomorTersamar({ nomor }: { nomor: string }) {
  const [tampil, setTampil] = useState(false);
  return (
    <span className="inline-flex items-center gap-2 font-mono">
      {tampil ? nomor : samarkan(nomor)}
      <button
        type="button"
        onClick={() => setTampil((t) => !t)}
        aria-label={tampil ? "Sembunyikan" : "Tampilkan"}
        className="rounded-pill p-1 text-muted hover:bg-surface-muted hover:text-fg"
      >
        {tampil ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  );
}

export function FormIdentitas({
  aksi,
  nilai,
}: {
  aksi: Aksi;
  nilai: { nik: string | null; no_kk: string | null } | null;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="NIK" bantuan="16 angka sesuai KTP/KK.">
          <input name="nik" inputMode="numeric" maxLength={16} autoComplete="off" defaultValue={nilai?.nik ?? ""} className={`${INPUT_CLASS} font-mono`} />
        </Kolom>
        <Kolom label="No. KK" bantuan="16 angka.">
          <input name="no_kk" inputMode="numeric" maxLength={16} autoComplete="off" defaultValue={nilai?.no_kk ?? ""} className={`${INPUT_CLASS} font-mono`} />
        </Kolom>
      </div>
      <Kirim pending={pending} state={state} />
    </form>
  );
}
