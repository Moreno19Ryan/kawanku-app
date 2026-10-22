/**
 * Nilai terstruktur pada laporan koreksi generus (bisa langsung diterapkan
 * admin). Fungsi murni, dipakai form generus, Server Action, dan daftar
 * laporan admin. Sama dengan cek usulan_koreksi_nilai_sah di database.
 */

import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH, RENTANG_KELAS, labelSekolah } from "@/lib/label";
import { tanggalPanjang } from "@/lib/waktu";

/** Bagian yang nilainya bisa dipilih (dan diterapkan sekali klik). */
export const BAGIAN_TERSTRUKTUR = ["status_sekolah", "status_pernikahan", "tanggal_lahir"] as const;

/**
 * Bagian yang dilaporkan generus ke admin. Data lain (tanggal lahir, status
 * sekolah, pendidikan, kontak, orang tua, alamat) diubah generus sendiri.
 */
export const BAGIAN_LAPOR_GENERUS = [
  "nama_lengkap",
  "jenis_kelamin",
  "status_pernikahan",
  "kelompok",
  "keluarga",
  "lainnya",
] as const;

export function bagianTerstruktur(bagian: string): boolean {
  return (BAGIAN_TERSTRUKTUR as readonly string[]).includes(bagian);
}

export type NilaiUsulan = { nilai: string | null; nilai_kelas: number | null };

/**
 * Baca & periksa nilai untuk satu bagian. Bagian lain → nilai kosong.
 * Hasil string = pesan galat.
 */
export function bacaNilaiUsulan(
  bagian: string,
  nilai: string,
  kelasTeks: string,
  hariIni: string,
): NilaiUsulan | string {
  if (!bagianTerstruktur(bagian)) return { nilai: null, nilai_kelas: null };
  if (bagian === "status_sekolah") {
    if (!(nilai in LABEL_STATUS_SEKOLAH)) return "Pilih status sekolah yang benar.";
    const rentang = RENTANG_KELAS[nilai];
    if (!rentang || !kelasTeks) return { nilai, nilai_kelas: null };
    const kelas = Number(kelasTeks);
    if (!Number.isInteger(kelas) || kelas < rentang[0] || kelas > rentang[1]) {
      return `Kelas ${LABEL_STATUS_SEKOLAH[nilai]} antara ${rentang[0]} dan ${rentang[1]}.`;
    }
    return { nilai, nilai_kelas: kelas };
  }
  if (bagian === "status_pernikahan") {
    if (!(nilai in LABEL_STATUS_PERNIKAHAN)) return "Pilih status pernikahan yang benar.";
    return { nilai, nilai_kelas: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai) || Number.isNaN(Date.parse(nilai))) return "Isi tanggal lahir yang benar.";
  if (nilai <= "1900-01-01" || nilai > hariIni) return "Tanggal lahir tidak masuk akal.";
  return { nilai, nilai_kelas: null };
}

/** Teks tampilan nilai, mis. "Kuliah", "SMA/SMK kelas 11", "5 Maret 2008". */
export function labelNilaiUsulan(bagian: string, nilai: string, kelas: number | null): string {
  if (bagian === "status_sekolah") return labelSekolah(nilai, kelas);
  if (bagian === "status_pernikahan") return LABEL_STATUS_PERNIKAHAN[nilai] ?? nilai;
  if (bagian === "tanggal_lahir") return tanggalPanjang(nilai);
  return nilai;
}
