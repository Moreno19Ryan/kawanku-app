/**
 * Asisten KawanKu: pengingat, peringatan, saran, dan apresiasi yang
 * dihitung dari data yang sudah ada (tanpa tabel baru). Fungsi murni;
 * pengambilan data ada di admin.ts & generus.ts (server-only).
 */

import type { Laporan } from "@/lib/absensi/laporan-hitung";
import { namaBulan } from "@/lib/absensi/laporan-hitung";
import { hariIniWib, tambahHari, type Kejadian } from "@/lib/kegiatan/jadwal";
import type { Kelengkapan } from "@/lib/generus/kelengkapan";

export type JenisSaran = "peringatan" | "pengingat" | "saran" | "apresiasi";

export type Saran = {
  /** Kunci unik (untuk React & menutup kartu). */
  kode: string;
  jenis: JenisSaran;
  judul: string;
  isi: string;
  href?: string;
};

const URUTAN: Record<JenisSaran, number> = { peringatan: 0, pengingat: 1, saran: 2, apresiasi: 3 };

export function urutkanSaran(saran: Saran[]): Saran[] {
  return [...saran].sort((a, b) => URUTAN[a.jenis] - URUTAN[b.jenis]);
}

function daftarNama(nama: string[], maks = 3): string {
  if (nama.length <= maks) return nama.join(", ");
  return `${nama.slice(0, maks).join(", ")}, dan ${nama.length - maks} lainnya`;
}

function jamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

export const hrefPertemuan = (k: Pick<Kejadian, "kegiatan" | "kelompokId" | "tanggal">) =>
  `/kegiatan/pertemuan?k=${k.kegiatan.id}&kel=${k.kelompokId ?? "desa"}&t=${k.tanggal}`;

/**
 * Kegiatan yang dikelola admin ini: pertemuan hari ini yang absensinya
 * belum dibuka (mulai ≤ 1 jam lagi), pengingat besok, dan pemateri yang
 * belum diisi untuk 7 hari ke depan.
 */
export function saranKegiatan(kejadian: Kejadian[], bolehKelola: (k: Kejadian) => boolean, sekarang = new Date()): Saran[] {
  const hasil: Saran[] = [];
  const hariIni = hariIniWib(sekarang);
  const besok = tambahHari(hariIni, 1);
  const kini = sekarang.getTime();
  const milik = kejadian.filter((k) => k.status === "terjadwal" && bolehKelola(k));

  for (const k of milik) {
    const mulai = new Date(k.mulai).getTime();
    const selesai = new Date(k.selesai).getTime();
    if (k.tanggal === hariIni && !k.sesiId && mulai - kini <= 3600_000 && selesai > kini) {
      hasil.push({
        kode: `buka-absensi:${k.kunci}`,
        jenis: "peringatan",
        judul: `Absensi ${k.kegiatan.nama} belum dibuka`,
        isi: `Mulai pukul ${jamWib(k.mulai)}. Buka absensinya supaya jamaah bisa scan kartu atau QR layar.`,
        href: hrefPertemuan(k),
      });
    }
  }
  const besokSaja = milik.filter((k) => k.tanggal === besok);
  if (besokSaja.length) {
    const k = besokSaja[0];
    hasil.push({
      kode: `besok:${k.kunci}`,
      jenis: "pengingat",
      judul: besokSaja.length === 1 ? `Besok: ${k.kegiatan.nama}` : `Besok ada ${besokSaja.length} pertemuan`,
      isi:
        besokSaja.length === 1
          ? `Pukul ${jamWib(k.mulai)}${k.pemateri ? `, pemateri ${k.pemateri}` : ", pemateri belum diisi"}. InsyaAllah lancar.`
          : besokSaja.map((x) => `${x.kegiatan.nama} ${jamWib(x.mulai)}`).join(" · "),
      href: besokSaja.length === 1 ? hrefPertemuan(k) : "/kegiatan",
    });
  }
  const tanpaPemateri = milik.filter((k) => !k.pemateri && k.tanggal >= hariIni && k.tanggal <= tambahHari(hariIni, 6));
  if (tanpaPemateri.length) {
    hasil.push({
      kode: "tanpa-pemateri",
      jenis: "saran",
      judul: `${tanpaPemateri.length} pertemuan 7 hari ke depan belum ada pematerinya`,
      isi: `Yang terdekat: ${tanpaPemateri[0].kegiatan.nama}, ${new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(tanpaPemateri[0].mulai))}.`,
      href: hrefPertemuan(tanpaPemateri[0]),
    });
  }
  return hasil;
}

/** Absensi yang dibuka manual dan belum ditutup padahal pertemuannya sudah selesai. */
export function saranSesiTerbuka(
  sesi: { id: string; nama: string; mulai: string; selesai: string | null }[],
  sekarang = new Date(),
): Saran[] {
  const lama = sesi.filter(
    (s) => new Date(s.selesai ?? new Date(s.mulai).getTime() + 2 * 3600_000).getTime() < sekarang.getTime(),
  );
  if (!lama.length) return [];
  return [
    {
      kode: "sesi-terbuka",
      jenis: "peringatan",
      judul: lama.length === 1 ? `Absensi ${lama[0].nama} belum ditutup` : `${lama.length} absensi belum ditutup`,
      isi: "Pengajiannya sudah selesai. Tutup absensinya supaya rekap rapi dan tidak ada scan susulan.",
      href: lama.length === 1 ? `/absensi/${lama[0].id}` : "/absensi",
    },
  ];
}

/** Pengajuan izin generus yang menunggu persetujuan admin ini. */
export function saranIzin(jumlah: number): Saran[] {
  if (!jumlah) return [];
  return [
    {
      kode: "izin-menunggu",
      jenis: "pengingat",
      judul: `${jumlah} pengajuan izin menunggu persetujuan`,
      isi: "Generus menunggu jawabanmu. Yang disetujui otomatis tercatat di absensi.",
      href: "/absensi/izin",
    },
  ];
}

/**
 * Dari laporan kehadiran 3 bulan: siapa yang perlu disapa, kelompok yang
 * turun dua bulan berturut-turut, dan apresiasi bila naik / ada yang rajin.
 */
export function saranLaporan(l: Laporan): Saran[] {
  const hasil: Saran[] = [];
  const sapa = l.jamaah.filter((b) => b.status === "perlu_disapa");
  if (sapa.length) {
    hasil.push({
      kode: "perlu-disapa",
      jenis: "saran",
      judul: `${sapa.length} jamaah perlu disapa`,
      isi: `Tidak hadir 3 pertemuan terakhir berturut-turut: ${daftarNama(sapa.map((b) => b.nama))}. Mungkin sedang ada kendala; sapaan hangat bisa membantu.`,
      href: "/absensi/laporan?status=perlu_disapa",
    });
  }

  const turun = (titik: { persen: number | null; bulan: string }[]) => {
    const isi = titik.filter((t) => t.persen !== null);
    if (isi.length < 3) return null;
    const [a, b, c] = isi.slice(-3);
    return a.persen! > b.persen! && b.persen! > c.persen! && a.persen! - c.persen! >= 10 ? { dari: a, ke: c } : null;
  };
  const seri = l.seri.length ? l.seri : [{ id: "total", nama: "Kehadiran", titik: l.tren }];
  for (const s of seri) {
    const t = turun(s.titik);
    if (t) {
      hasil.push({
        kode: `turun:${s.id}`,
        jenis: "peringatan",
        judul: `${s.nama === "Kehadiran" ? "Kehadiran" : `Kehadiran ${s.nama}`} turun dua bulan berturut-turut`,
        isi: `${namaBulan(t.dari.bulan)} ${t.dari.persen}% → ${namaBulan(t.ke.bulan)} ${t.ke.persen}%. Perlu dicari tahu penyebabnya bersama pengurus.`,
        href: "/absensi/laporan",
      });
    }
  }

  const isi = l.tren.filter((t) => t.persen !== null);
  if (isi.length >= 2) {
    const [lalu, kini] = isi.slice(-2);
    if (kini.persen! - lalu.persen! >= 5) {
      hasil.push({
        kode: "naik",
        jenis: "apresiasi",
        judul: `Alhamdulillah, kehadiran naik ${kini.persen! - lalu.persen!} poin`,
        isi: `${namaBulan(lalu.bulan)} ${lalu.persen}% → ${namaBulan(kini.bulan)} ${kini.persen}%. Alhamdulillah Jazakumullahu Khoiro untuk semua pengurus.`,
        href: "/absensi/laporan",
      });
    }
  }
  const rajin = l.jamaah.filter((b) => b.status === "rajin");
  if (rajin.length) {
    hasil.push({
      kode: "rajin",
      jenis: "apresiasi",
      judul: `MasyaAllah, ${rajin.length} jamaah rajin hadir`,
      isi: `Hadir minimal 85% dalam 3 bulan terakhir: ${daftarNama(rajin.map((b) => b.nama))}. Layak disampaikan apresiasi.`,
      href: "/absensi/laporan?status=rajin",
    });
  }
  return hasil;
}

/** Untuk generus: hasil pengajuan izin 7 hari terakhir & ajakan melengkapi data diri. */
export function saranGenerus(opsi: {
  izin: { id: string; status: "disetujui" | "ditolak"; kegiatan: string; tanggal: string; tanggapan: string | null }[];
  kelengkapan: Kelengkapan;
  /** Jadwal beberapa hari ke depan (untuk pengingat H-1). */
  jadwal?: Kejadian[];
  sekarang?: Date;
}): Saran[] {
  const hasil: Saran[] = [];
  const besok = tambahHari(hariIniWib(opsi.sekarang), 1);
  const esok = (opsi.jadwal ?? []).filter((k) => k.status === "terjadwal" && k.tanggal === besok);
  if (esok.length) {
    hasil.push({
      kode: `besok:${esok[0].kunci}`,
      jenis: "pengingat",
      judul: `Besok ada ${esok[0].kegiatan.nama}`,
      isi: `Pukul ${jamWib(esok[0].mulai)} WIB${esok[0].pemateri ? `, bersama ${esok[0].pemateri}` : ""}. InsyaAllah hadir, ya. Berhalangan? Ajukan izin dari sekarang.`,
      href: "/saya/jadwal",
    });
  }
  for (const i of opsi.izin) {
    const tgl = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${i.tanggal}T00:00:00Z`),
    );
    hasil.push({
      kode: `izin:${i.id}`,
      jenis: i.status === "disetujui" ? "pengingat" : "peringatan",
      judul: i.status === "disetujui" ? `Izinmu disetujui` : `Izinmu belum bisa disetujui`,
      isi: `${i.kegiatan}, ${tgl}.${i.tanggapan ? ` Catatan admin: "${i.tanggapan}".` : ""}${i.status === "ditolak" ? " InsyaAllah usahakan hadir, ya." : ""}`,
      href: "/saya/izin",
    });
  }
  const { persen, kurang, hanyaAlamat } = opsi.kelengkapan;
  if (kurang.length) {
    hasil.push({
      kode: `lengkapi-data:${persen}`,
      jenis: "saran",
      judul: `Data dirimu baru ${persen}% lengkap`,
      isi: `Yuk lengkapi: ${kurang.join(", ")}. Supaya pengurus punya data yang benar dan mudah menghubungimu.`,
      href: hanyaAlamat ? "/saya/alamat" : "/saya/profil",
    });
  }
  return hasil;
}
