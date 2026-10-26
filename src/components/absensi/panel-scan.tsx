"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Camera, CircleAlert, CircleCheck, ScanLine, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { KameraQr } from "@/components/ui/kamera-qr";
import type { HasilScan } from "@/lib/absensi/actions";
import { bunyi, type JenisBunyi } from "@/lib/absensi/bunyi";
import { ucapanSyukur } from "@/lib/label";
import { jam } from "@/lib/waktu";

/** Teks besar di layar setelah scan. */
const PESAN: Record<HasilScan["hasil"], string> = {
  tercatat: "Kamu sudah tercatat hadir",
  sudah: "Alhamdulillah, kamu sudah absen sebelumnya",
  tidak_dikenal: "Kode tidak dikenal",
  kartu_dicabut: "Kartu ini sudah dicabut (diganti kartu baru)",
  pakai_akun: "Kartu tidak berlaku: generus absen lewat akunnya (scan QR layar)",
  sesi_ditutup: "Sesi sudah ditutup",
  belum_waktunya: "Absensi belum terbuka: 30 menit sebelum mulai",
  lewat_waktu: "Absensi sudah lewat waktunya",
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

/** Kartu yang sama baru dibaca lagi setelah tidak terlihat kamera selama ini. */
const JEDA_KODE_SAMA_MS = 2500;

/**
 * Kolom scan untuk scanner barcode USB (mengetik kode + Enter) atau ketik
 * kode jamaah (KW-XXXXXX). Fokus selalu kembali ke kolom setelah scan.
 * Di HP (tanpa scanner): "Scan pakai kamera" membaca kartu satu per satu.
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
  const [kamera, setKamera] = useState(false);
  const [pending, startTransition] = useTransition();
  const sibuk = useRef(false);
  const kodeKamera = useRef<{ kode: string; waktu: number } | null>(null);
  const terakhir = riwayat[0];

  function kirim(kode: string, fokus: boolean) {
    sibuk.current = true;
    startTransition(async () => {
      const hasil = await catat(kode);
      if (suara) bunyi(jenis(hasil.hasil));
      setRiwayat((r) => [{ ...hasil, no: (r[0]?.no ?? 0) + 1, kodeAsal: kode }, ...r].slice(0, 8));
      sibuk.current = false;
      if (fokus) input.current?.focus();
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = input.current;
    const kode = el?.value.trim() ?? "";
    if (!el || !kode) return;
    el.value = "";
    kirim(kode, true);
  }

  /** QR dari kamera: satu per satu, kartu yang sama tidak dicatat berulang. */
  function bacaKamera(isi: string) {
    const kode = isi.trim();
    const kini = Date.now();
    const lalu = kodeKamera.current;
    if (lalu && lalu.kode === kode && kini - lalu.waktu < JEDA_KODE_SAMA_MS) {
      // Kartu masih di depan kamera: perpanjang jedanya, jangan dicatat lagi.
      lalu.waktu = kini;
      return "lanjut" as const;
    }
    if (!kode || sibuk.current) return "lanjut" as const;
    kodeKamera.current = { kode, waktu: kini };
    kirim(kode, false);
    return "lanjut" as const;
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
      {kamera && (
        <div className="mx-auto w-full max-w-sm">
          <KameraQr
            onBaca={bacaKamera}
            className="aspect-[4/3] w-full"
            catatanGagal="Masih tidak bisa? Ketik kode jamaah (KW-…) di kolom bawah, atau tandai hadir dari daftar peserta."
            keterangan={
              <p className="text-center text-sm text-muted">Arahkan kartu ke kamera satu per satu. Hasil tampil di bawah.</p>
            }
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setKamera((k) => !k)}
        className={buttonClass(kamera ? "netral" : "kedua", "self-start")}
      >
        {kamera ? <X className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        {kamera ? "Tutup kamera" : "Scan pakai kamera HP"}
      </button>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:flex-1">
          <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={input}
            autoFocus={!kamera}
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
              <span className="block text-lg font-semibold">
                {terakhir.hasil === "tercatat"
                  ? `${ucapanSyukur(terakhir.jenisKelamin)}, kamu sudah tercatat hadir`
                  : PESAN[terakhir.hasil]}
              </span>
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
            {kamera
              ? "Arahkan kartu ke kamera. Hasil tampil di sini."
              : "Arahkan kursor ke kolom di atas, lalu scan kartu satu per satu. Hasil tampil di sini."}
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
