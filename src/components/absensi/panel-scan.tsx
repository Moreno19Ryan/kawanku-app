"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CircleAlert, CircleCheck, ScanLine } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { HasilScan } from "@/lib/absensi/actions";

const PESAN: Record<HasilScan["hasil"], string> = {
  tercatat: "Hadir, tercatat",
  sudah: "Sudah tercatat sebelumnya",
  tidak_dikenal: "Kode tidak dikenal",
  kartu_dicabut: "Kartu ini sudah dicabut (diganti kartu baru)",
  sesi_ditutup: "Sesi sudah ditutup",
  bukan_peserta: "Bukan peserta sesi ini",
  jamaah_nonaktif: "Jamaah tidak aktif",
  tidak_berhak: "Di luar wewenangmu",
  galat: "Gagal mencatat. Coba lagi.",
};

type Riwayat = HasilScan & { no: number; kodeAsal: string };

/** Bunyi pendek: nada tinggi = berhasil, nada rendah = perlu perhatian. */
function bunyi(berhasil: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = berhasil ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (berhasil ? 0.12 : 0.3));
    osc.onended = () => void ctx.close();
  } catch {
    // Browser tanpa Web Audio: abaikan.
  }
}

/**
 * Kolom scan untuk scanner barcode USB (mengetik kode + Enter) atau ketik
 * kode jamaah (KW-XXXXXX). Fokus selalu kembali ke kolom setelah scan.
 */
export function PanelScan({
  catat,
  bolehLihatKeringanan,
}: {
  catat: (kode: string) => Promise<HasilScan>;
  bolehLihatKeringanan: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [suara, setSuara] = useState(true);
  const [pending, startTransition] = useTransition();
  const terakhir = riwayat[0];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = input.current;
    const kode = el?.value.trim() ?? "";
    if (!el || !kode) return;
    el.value = "";
    startTransition(async () => {
      const hasil = await catat(kode);
      const berhasil = hasil.hasil === "tercatat";
      if (suara) bunyi(berhasil || hasil.hasil === "sudah");
      setRiwayat((r) => [{ ...hasil, no: (r[0]?.no ?? 0) + 1, kodeAsal: kode }, ...r].slice(0, 8));
      el.focus();
    });
  }

  const nadaTerakhir =
    !terakhir
      ? ""
      : terakhir.hasil === "tercatat"
        ? "bg-success/10 text-success"
        : terakhir.hasil === "sudah"
          ? "bg-primary-soft text-primary"
          : "bg-danger/10 text-danger";

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:flex-1">
          <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={input}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={40}
            placeholder="Scan kartu, atau ketik kode jamaah (KW-…)"
            aria-label="Kode kartu atau kode jamaah"
            className={`${INPUT_CLASS} w-full pl-12 font-mono text-base tracking-wider`}
          />
        </div>
        <button type="submit" disabled={pending} className={buttonClass("utama", "h-12 shrink-0")}>
          {pending ? "Mencatat…" : "Catat"}
        </button>
      </form>

      <div
        role="status"
        aria-live="assertive"
        className={`flex min-h-20 items-center gap-4 rounded-card px-5 py-4 transition-colors duration-200 ease-oneui ${
          terakhir ? nadaTerakhir : "bg-surface-muted text-muted"
        }`}
      >
        {terakhir ? (
          <>
            {terakhir.hasil === "tercatat" || terakhir.hasil === "sudah" ? (
              <CircleCheck className="size-8 shrink-0" aria-hidden />
            ) : (
              <CircleAlert className="size-8 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold">
                {terakhir.nama ?? PESAN[terakhir.hasil]}
              </span>
              <span className="block text-sm">
                {terakhir.nama ? PESAN[terakhir.hasil] : terakhir.kodeAsal}
                {terakhir.kelompok ? ` · ${terakhir.kelompok}` : ""}
                {bolehLihatKeringanan && terakhir.keringanan ? " · Keringanan (tanpa HP)" : ""}
              </span>
            </span>
          </>
        ) : (
          <span className="text-sm">
            Arahkan kursor ke kolom di atas, lalu scan kartu satu per satu. Hasil tampil di sini.
          </span>
        )}
      </div>

      {riwayat.length > 1 && (
        <ul className="flex flex-col gap-1 text-sm">
          {riwayat.slice(1).map((r) => (
            <li key={r.no} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-muted">
              <span className="truncate">{r.nama ?? r.kodeAsal}</span>
              <span className={r.hasil === "tercatat" ? "text-success" : r.hasil === "sudah" ? "" : "text-danger"}>
                {PESAN[r.hasil]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={suara} onChange={(e) => setSuara(e.target.checked)} className="size-4" />
        Bunyi saat scan
      </label>
    </div>
  );
}
