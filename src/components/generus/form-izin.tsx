"use client";

import { useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { ajukanIzin } from "@/lib/generus/actions";
import { LABEL_ALASAN_IZIN } from "@/lib/label";

/** Pilih pertemuan → izin (alasan) atau sakit → kirim ke admin. */
export function FormIzin({
  pilihan,
  awal,
}: {
  /** value = kegiatanId|tanggal */
  pilihan: { value: string; label: string }[];
  awal?: string;
}) {
  const [state, onSubmit, pending] = useFormAksi(ajukanIzin);
  const [jenis, setJenis] = useState<"izin" | "sakit">("izin");
  if (pilihan.length === 0) {
    return <p className="text-sm text-muted">Tidak ada pertemuan dalam 14 hari ke depan.</p>;
  }
  return (
    <form key={state.pesan ?? "baru"} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pertemuan</span>
        <select name="kejadian" required defaultValue={awal ?? ""} className={INPUT_CLASS}>
          <option value="" disabled>
            Pilih…
          </option>
          {pilihan.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Keterangan</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["izin", "sakit"] as const).map((j) => (
            <label
              key={j}
              className={`flex h-12 cursor-pointer items-center justify-center rounded-control border text-sm font-medium transition-colors ${
                jenis === j ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface-muted"
              }`}
            >
              <input
                type="radio"
                name="jenis"
                value={j}
                checked={jenis === j}
                onChange={() => setJenis(j)}
                className="sr-only"
              />
              {j === "izin" ? "Izin" : "Sakit"}
            </label>
          ))}
        </div>
      </fieldset>

      {jenis === "izin" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Alasan</span>
            <select name="alasan_izin" required defaultValue="" className={INPUT_CLASS}>
              <option value="" disabled>
                Pilih…
              </option>
              {Object.entries(LABEL_ALASAN_IZIN).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Catatan (opsional)</span>
            <input name="keterangan" maxLength={150} placeholder="Mis. ada praktikum sampai malam" className={INPUT_CLASS} />
          </label>
        </>
      ) : (
        <p className="text-xs text-muted">
          Cukup pilih sakit; tidak perlu menulis penyakitnya. Semoga lekas sembuh 🤲
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama", "h-11 px-5")}>
          {pending ? "Mengirim…" : "Kirim pengajuan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
