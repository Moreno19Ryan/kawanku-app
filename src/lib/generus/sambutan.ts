/**
 * Sambutan Beranda generus yang "ingat": salam sesuai waktu, lalu satu
 * kalimat paling relevan (baru kembali hadir, baru sakit, atau pengajian
 * terdekat). Fungsi murni; semua tanggal dalam WIB.
 */
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import type { CatatanKehadiran } from "./kehadiran";

export type Sambutan = {
  /** "Selamat pagi" … "Selamat malam". */
  salam: string;
  /** Satu kalimat konteks, atau null bila tidak ada yang khusus. */
  pesan: string | null;
  nada: "biasa" | "syukur";
};

type Berikut = { nama: string; tanggal: string; mulai: string } | null | undefined;

const jamWib = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(d));

const pukul = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));

export function salamWaktu(sekarang = new Date()): string {
  const jam = jamWib(sekarang);
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

export function sambutan(opsi: {
  catatan: CatatanKehadiran[];
  berikut?: Berikut;
  sekarang?: Date;
}): Sambutan {
  const sekarang = opsi.sekarang ?? new Date();
  const hariIni = hariIniWib(sekarang);
  const salam = salamWaktu(sekarang);
  const selesai = [...opsi.catatan]
    .filter((c) => c.status !== "berjalan")
    .sort((a, b) => b.mulai.localeCompare(a.mulai));
  const hariSejak = (iso: string) => (sekarang.getTime() - new Date(iso).getTime()) / 86_400_000;

  // 1. Baru kembali hadir setelah ≥ 2 pertemuan terlewat berturut-turut.
  const [a, b, c] = selesai;
  if (a?.status === "hadir" && b?.status === "alpa" && c?.status === "alpa" && hariSejak(a.mulai) <= 7) {
    return { salam, pesan: "Alhamdulillah, senang kamu bisa hadir kembali. Semoga istiqomah.", nada: "syukur" };
  }

  // 2. Baru sakit (pertemuan terakhir, ≤ 14 hari).
  if (a?.status === "sakit" && hariSejak(a.mulai) <= 14) {
    return { salam, pesan: "Semoga sudah sehat, ya. Kami tunggu di pengajian berikutnya.", nada: "biasa" };
  }

  // 3. Pengajian terdekat hari ini / besok.
  const k = opsi.berikut;
  if (k && k.mulai > sekarang.toISOString()) {
    if (k.tanggal === hariIni) {
      return { salam, pesan: `Nanti pukul ${pukul(k.mulai)} ada ${k.nama}. InsyaAllah hadir, ya.`, nada: "biasa" };
    }
    if (k.tanggal === tambahHari(hariIni, 1)) {
      return { salam, pesan: `Besok pukul ${pukul(k.mulai)} ada ${k.nama}.`, nada: "biasa" };
    }
  }
  return { salam, pesan: null, nada: "biasa" };
}
