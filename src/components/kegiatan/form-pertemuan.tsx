"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
const LABEL = "text-sm font-medium";

export type PilihanPemateri = { nilai: string; label: string };
export type SesiAwal = { pilih: string; nama: string; materi: string };
type Sesi = SesiAwal & { kunci: number };

const MAKS_SESI = 10;

/**
 * Sesi-sesi pertemuan (pemateri dari daftar pengajar rutin / muballigh data
 * jamaah / ketik nama, beserta materinya), catatan, dan pindah waktu.
 */
export function FormPertemuan({
  aksi,
  pengajar,
  muballigh,
  awal,
}: {
  aksi: Aksi;
  pengajar: PilihanPemateri[];
  muballigh: PilihanPemateri[];
  awal: { sesi: SesiAwal[]; catatan: string | null; mulai: string };
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [sesi, setSesi] = useState<Sesi[]>(() =>
    (awal.sesi.length ? awal.sesi : [{ pilih: "", nama: "", materi: "" }]).map((x, i) => ({ ...x, kunci: i })),
  );
  const ubah = (kunci: number, isi: Partial<SesiAwal>) =>
    setSesi((d) => d.map((x) => (x.kunci === kunci ? { ...x, ...isi } : x)));
  const banyak = sesi.length > 1;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="sesi" value={JSON.stringify(sesi.map(({ pilih, nama, materi }) => ({ pilih, nama, materi })))} />
      <ol className="flex flex-col gap-3 sm:col-span-2">
        {sesi.map((x, i) => (
          <li key={x.kunci} className="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
            {banyak && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted">Sesi {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setSesi((d) => d.filter((y) => y.kunci !== x.kunci))}
                  className="text-sm font-medium text-danger"
                >
                  Hapus sesi
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Pemateri</span>
                <select value={x.pilih} onChange={(e) => ubah(x.kunci, { pilih: e.target.value })} className={INPUT_CLASS}>
                  <option value="">Belum ditentukan</option>
                  {pengajar.length > 0 && (
                    <optgroup label="Pengajar rutin">
                      {pengajar.map((m) => (
                        <option key={m.nilai} value={m.nilai}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {muballigh.length > 0 && (
                    <optgroup label="Muballigh (data jamaah)">
                      {muballigh.map((m) => (
                        <option key={m.nilai} value={m.nilai}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="lain">Lainnya (ketik nama)…</option>
                </select>
              </label>
              {x.pilih === "lain" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>Nama pemateri</span>
                  <input
                    required
                    maxLength={120}
                    value={x.nama}
                    onChange={(e) => ubah(x.kunci, { nama: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              ) : (
                <div className="hidden sm:block" />
              )}
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={LABEL}>Materi</span>
                <input
                  maxLength={300}
                  value={x.materi}
                  onChange={(e) => ubah(x.kunci, { materi: e.target.value })}
                  placeholder="mis. Hadits Bab Sholat, Makna Quran Juz 3"
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </li>
        ))}
      </ol>
      {sesi.length < MAKS_SESI && (
        <button
          type="button"
          onClick={() =>
            setSesi((d) => [...d, { pilih: "", nama: "", materi: "", kunci: Math.max(...d.map((y) => y.kunci), 0) + 1 }])
          }
          className={buttonClass("kedua", "justify-self-start sm:col-span-2")}
        >
          <Plus className="size-4" aria-hidden />
          Tambah pemateri / sesi
        </button>
      )}
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
