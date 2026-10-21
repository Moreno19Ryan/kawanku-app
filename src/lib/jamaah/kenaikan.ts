/**
 * Kenaikan kelas tahunan (docs/status-sekolah-tahunan.md). Fungsi murni:
 * tahun ajaran, pilihan aksi per jamaah, dan hasilnya. Sama dengan
 * private.tahun_ajaran & cek jamaah_kelas_jenjang di database.
 */

import { LABEL_STATUS_SEKOLAH, RENTANG_KELAS } from "@/lib/label";

/** Tahun ajaran (tahun Juli-nya) untuk sebuah tanggal, WIB. */
export function tahunAjaran(sekarang = new Date()): number {
  const [t, b] = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", timeZone: "Asia/Jakarta" })
    .format(sekarang)
    .split("-")
    .map(Number);
  return b < 7 ? t - 1 : t;
}

export const labelTahunAjaran = (t: number) => `${t}/${t + 1}`;

/** Masa pengingat di Beranda: Juli–September. */
export function masaKenaikan(sekarang = new Date()): boolean {
  const b = Number(new Intl.DateTimeFormat("en-GB", { month: "numeric", timeZone: "Asia/Jakarta" }).format(sekarang));
  return b >= 7 && b <= 9;
}

export type Hasil = { status_sekolah: string; kelas: number | null };

/** Status sekolah untuk sebuah kelas (1–6 SD, 7–9 SMP, 10–12 SMA/SMK). */
export function jenjangKelas(kelas: number): string {
  return kelas <= 6 ? "sd" : kelas <= 9 ? "smp" : "sma_smk";
}

const LULUS = ["kuliah", "bekerja", "lainnya"] as const;

/**
 * Pilihan aksi untuk satu jamaah. Kelas kosong → isi kelas sekarang (tanpa
 * dinaikkan). Kelas 12 → lulus (wajib dipilih). Lainnya → naik / tinggal.
 */
export function pilihanAksi(status: string, kelas: number | null): { nilai: string; label: string }[] {
  const lewati = { nilai: "lewati", label: kelas === null || kelas === 12 ? "Pilih…" : "Lewati (tidak diubah)" };
  if (kelas === null) {
    const [a, b] = RENTANG_KELAS[status] ?? [1, 12];
    return [
      lewati,
      ...Array.from({ length: b - a + 1 }, (_, i) => ({
        nilai: `kelas:${a + i}`,
        label: `Sekarang kelas ${a + i}`,
      })),
    ];
  }
  const naik =
    kelas < 12
      ? [
          {
            nilai: "naik",
            label:
              jenjangKelas(kelas + 1) === status
                ? `Naik ke kelas ${kelas + 1}`
                : `Lulus → ${LABEL_STATUS_SEKOLAH[jenjangKelas(kelas + 1)]} kelas ${kelas + 1}`,
          },
        ]
      : LULUS.map((s) => ({ nilai: `lulus:${s}`, label: `Lulus → ${LABEL_STATUS_SEKOLAH[s]}` }));
  return [...naik, { nilai: "tinggal", label: `Tetap kelas ${kelas}` }, lewati];
}

/** Aksi bawaan: naik kelas; kelas 12 & kelas kosong harus dipilih admin. */
export function aksiBawaan(kelas: number | null): string {
  return kelas === null || kelas === 12 ? "lewati" : "naik";
}

/** Hasil sebuah aksi; null = tidak diubah (atau aksi tidak sah). */
export function hasilAksi(status: string, kelas: number | null, aksi: string): Hasil | null {
  if (!pilihanAksi(status, kelas).some((p) => p.nilai === aksi) || aksi === "lewati") return null;
  if (aksi === "naik") return { status_sekolah: jenjangKelas(kelas! + 1), kelas: kelas! + 1 };
  if (aksi === "tinggal") return { status_sekolah: status, kelas };
  if (aksi.startsWith("lulus:")) return { status_sekolah: aksi.slice(6), kelas: null };
  if (aksi.startsWith("kelas:")) return { status_sekolah: status, kelas: Number(aksi.slice(6)) };
  return null;
}
