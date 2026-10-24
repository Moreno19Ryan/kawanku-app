/**
 * Satu sumber alamat aplikasi (domain produksi sekarang:
 * https://inikawanku.com). Urutan:
 *   1. NEXT_PUBLIC_SITE_URL (diisi di Vercel Environment Variables);
 *   2. VERCEL_PROJECT_PRODUCTION_URL (otomatis dari Vercel, tanpa protokol);
 *   3. http://localhost:3000 (pengembangan lokal).
 * Dipakai metadataBase (tautan gambar pratinjau) dan tautan yang dibagikan
 * ke jamaah (slip & pesan info masuk). Jangan tulis domain langsung di kode.
 */
const LOKAL = "http://localhost:3000";

/** Rapikan: tambah https:// bila tanpa protokol, buang garis miring di akhir. */
function rapikan(nilai: string): string {
  const isi = nilai.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(isi) ? isi : `https://${isi}`;
}

export function alamatSitus(): string {
  const nilai = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return nilai ? rapikan(nilai) : LOKAL;
}
