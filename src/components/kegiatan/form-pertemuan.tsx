"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
const LABEL = "text-sm font-medium";

/** Pemateri (muballigh dari data jamaah, atau ketik), materi, catatan, pindah waktu. */
export function FormPertemuan({
  aksi,
  muballigh,
  awal,
}: {
  aksi: Aksi;
  muballigh: { id: string; label: string }[];
  awal: { pemateriId: string | null; pemateri: string | null; materi: string | null; catatan: string | null; mulai: string };
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [pilih, setPilih] = useState(awal.pemateriId ?? (awal.pemateri ? "lain" : ""));
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Pemateri</span>
        <select name="pemateri_id" value={pilih} onChange={(e) => setPilih(e.target.value)} className={INPUT_CLASS}>
          <option value="">Belum ditentukan</option>
          {muballigh.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="lain">Lainnya (ketik nama)…</option>
        </select>
      </label>
      {pilih === "lain" ? (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Nama pemateri</span>
          <input name="pemateri_nama" required maxLength={120} defaultValue={awal.pemateri ?? ""} className={INPUT_CLASS} />
        </label>
      ) : (
        <div className="hidden sm:block" />
      )}
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>Materi</span>
        <input
          name="materi"
          maxLength={300}
          defaultValue={awal.materi ?? ""}
          placeholder="mis. Hadits Bab Sholat, Makna Quran Juz 3"
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LABEL}>
          Catatan <span className="font-normal text-muted">(opsional)</span>
        </span>
        <textarea name="catatan" maxLength={1000} rows={2} defaultValue={awal.catatan ?? ""} className={`${INPUT_CLASS} h-auto py-3`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>
          Waktu <span className="font-normal text-muted">(ubah bila dipindah)</span>
        </span>
        <input type="datetime-local" name="mulai" defaultValue={awal.mulai} required className={INPUT_CLASS} />
      </label>
      <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

const ALASAN_CEPAT = ["Hari Keluarga se-Daerah", "Hasil musyawarah pengurus", "Bertepatan dengan acara desa/daerah"];

export function FormBatalPertemuan({ aksi }: { aksi: Aksi }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [alasan, setAlasan] = useState("");
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ALASAN_CEPAT.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAlasan(a)}
            className="rounded-pill bg-surface-muted px-3 py-1.5 text-xs font-medium hover:bg-border"
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="alasan"
          required
          maxLength={200}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan libur / batal"
          aria-label="Alasan batal"
          className={`${INPUT_CLASS} sm:flex-1`}
        />
        <button type="submit" disabled={pending} className={buttonClass("bahaya", "h-12 shrink-0")}>
          {pending ? "Menyimpan…" : "Tandai libur / batal"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
