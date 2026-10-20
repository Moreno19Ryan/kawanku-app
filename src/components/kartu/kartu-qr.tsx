import type { ReactNode } from "react";
import { LogoDesa } from "@/components/brand/logo-desa";

type KartuQrProps = {
  nama: string;
  kelompok: string;
  /** Gambar QR (Fase 2). Kosong = kotak penanda posisi. */
  qr?: ReactNode;
  /** Kode yang tercetak di bawah QR, untuk input manual bila scan gagal. */
  kode?: string;
};

/**
 * Kartu QR absensi jalur 1, ukuran kartu KTP (ID-1, 85,6 × 54 mm).
 * Logo desa: vektor, tinggi ≥ 10 mm, ruang kosong ≥ ½ tinggi logo di semua
 * sisi, di atas latar polos. Penanda keringanan TIDAK dicetak di kartu
 * (hanya terlihat admin di aplikasi).
 */
export function KartuQr({ nama, kelompok, qr, kode }: KartuQrProps) {
  return (
    <article className="flex h-[54mm] w-[85.6mm] shrink-0 overflow-hidden rounded-[3mm] border border-border bg-paper text-paper-fg [print-color-adjust:exact]">
      <div className="flex min-w-0 flex-1 flex-col justify-between p-[4mm]">
        {/* Logo 12 mm dengan ruang kosong 6 mm (½ tinggi logo) di semua sisi;
            -m-[4mm] menetralkan padding kartu. */}
        <div className="-m-[4mm] mb-0 w-fit p-[6mm]">
          <LogoDesa height={45} tone="light" className="h-[12mm] w-auto" />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[11pt] font-bold leading-tight">{nama}</p>
          <p className="text-[8pt] text-paper-muted">{kelompok}</p>
          <p className="mt-[1mm] text-[6.5pt] text-paper-muted">
            Desa Kartika Wanasari · KawanKu
          </p>
        </div>
      </div>

      <div className="flex w-[40mm] flex-col items-center justify-center gap-[1mm] p-[3mm]">
        <div className="flex size-[34mm] items-center justify-center">
          {qr ?? (
            <div className="flex size-full items-center justify-center rounded-[1mm] border border-dashed border-paper-muted text-[8pt] text-paper-muted">
              QR
            </div>
          )}
        </div>
        {kode ? (
          <p className="font-mono text-[7pt] tracking-wider">{kode}</p>
        ) : null}
      </div>
    </article>
  );
}
