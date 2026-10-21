"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CircleAlert, CircleCheck, ScanLine } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { HasilScan } from "@/lib/absensi/actions";
import { bunyi, type JenisBunyi } from "@/lib/absensi/bunyi";
import { jam } from "@/lib/waktu";

/** Teks besar di layar setelah scan. */
const PESAN: Record<HasilScan["hasil"], string> = {
  tercatat: "Alhamdulillah, kamu sudah tercatat hadir",
  sudah: "Alhamdulillah, kamu sudah absen sebelumnya",
  tidak_dikenal: "Kode tidak dikenal",
  kartu_dicabut: "Kartu ini sudah dicabut (diganti kartu baru)",
  pakai_akun: "Kartu tidak berlaku: generus absen lewat akunnya (scan QR layar)",
  sesi_ditutup: "Sesi sudah ditutup",
  bukan_peserta: "Bukan peserta sesi ini",
  jamaah_nonaktif: "Jamaah tidak aktif",
  tidak_berhak: "Di luar wewenangmu",
  galat: "Gagal mencatat. Coba lagi.",
};

/** Label singkat untuk riwayat scan. */
const RINGKAS: Partial<Record<HasilScan["hasil"], string>> = {
  tercatat: "Hadir, tercatat",
  sudah: "Sudah absen",
};

type Riwayat = HasilScan & { no: number; kodeAsal: string };
function jenis(h: HasilScan["hasil"]): JenisBunyi {
  return h === "tercatat" ? "berhasil" : h === "sudah" ? "sudah" : "gagal";
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
      if (suara) bunyi(jenis(hasil.hasil));
      setRiwayat((r) => [{ ...hasil, no: (r[0]?.no ?? 0) + 1, kodeAsal: kode }, ...r].slice(0, 8));
      el.focus();
    });
  }

  const nadaTerakhir = !terakhir
    ? ""
    : {
        berhasil: "bg-success/10 text-success",
        sudah: "bg-primary-soft text-primary",
        gagal: "bg-danger/10 text-danger",
      }[jenis(terakhir.hasil)];

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
              <span className="block text-lg font-semibold">{PESAN[terakhir.hasil]}</span>
              <span className="block text-sm">
                {[
                  terakhir.nama ?? terakhir.kodeAsal,
                  terakhir.kelompok,
                  terakhir.dicatatAt ? `tercatat pukul ${jam(terakhir.dicatatAt)}` : null,
                  bolehLihatKeringanan && terakhir.keringanan ? "Keringanan (tanpa HP)" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
              <span className={{ berhasil: "text-success", sudah: "text-primary", gagal: "text-danger" }[jenis(r.hasil)]}>
                {RINGKAS[r.hasil] ?? PESAN[r.hasil]}
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
