"use client";

import { addTransitionType, startTransition, useActionState, useState, type FormEvent } from "react";
import { Check, ClipboardCopy, FileText } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { BATAS_CERITA, PILIHAN_RENTANG } from "@/lib/sistem/laporan-masalah";
import { susunLaporanMasalah, type HasilLaporan } from "@/lib/sistem/laporan-actions";

/**
 * Susun laporan (server) lalu salin. Dua langkah terpisah, karena browser
 * (terutama Safari) menolak menyalin bila tidak langsung dari tekanan tombol.
 */
export function LaporanMasalah() {
  const [state, kirim, pending] = useActionState<HasilLaporan, FormData>(susunLaporanMasalah, {});
  const [tersalin, setTersalin] = useState<"ya" | "gagal" | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setTersalin(null);
    startTransition(() => {
      addTransitionType("diam");
      kirim(data);
    });
  }

  async function salin() {
    if (!state.teks) return;
    try {
      await navigator.clipboard.writeText(state.teks);
      setTersalin("ya");
    } catch {
      setTersalin("gagal");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ceritakan masalahnya (opsional)</span>
          <textarea
            name="cerita"
            rows={3}
            maxLength={BATAS_CERITA}
            placeholder="Mis. sejak pukul 19.00 admin Kelompok 2 tidak bisa membuka halaman Absensi."
            className={`${INPUT_CLASS} h-auto py-3`}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Rentang waktu</span>
            <select name="rentang" defaultValue="24" className={INPUT_CLASS}>
              {PILIHAN_RENTANG.map((p) => (
                <option key={p.jam} value={p.jam}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending} className={buttonClass("utama")}>
            <FileText className="size-4" aria-hidden />
            {pending ? "Menyusun…" : state.teks ? "Susun ulang" : "Susun laporan"}
          </button>
        </div>
      </form>

      {state.galat && (
        <p role="status" className="text-sm text-danger">
          {state.galat}
        </p>
      )}

      {state.teks && (
        <div className="flex flex-col gap-3">
          <textarea
            readOnly
            value={state.teks}
            rows={12}
            aria-label="Isi laporan masalah"
            onFocus={(e) => e.currentTarget.select()}
            className={`${INPUT_CLASS} h-auto py-3 font-mono text-xs`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={salin} className={buttonClass("kedua")}>
              {tersalin === "ya" ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <ClipboardCopy className="size-4" aria-hidden />
              )}
              {tersalin === "ya" ? "Tersalin" : "Salin laporan"}
            </button>
            <p role="status" aria-live="polite" className="text-sm text-muted">
              {tersalin === "ya"
                ? "Alhamdulillah, tersalin. Tempel di chat asisten pengembang."
                : tersalin === "gagal"
                  ? "Mohon maaf, browser menolak menyalin. Silakan pilih semua teks di atas lalu salin manual."
                  : "Mohon dibaca dulu sebelum dikirim."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
