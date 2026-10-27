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
 * Kegiatan yang dikelola admin ini: pengingat besok dan pemateri yang
 * belum diisi untuk 7 hari ke depan. (Absensi terbuka & tertutup otomatis,
 * jadi tidak ada pengingat buka/tutup absensi.)
 */
export function saranKegiatan(kejadian: Kejadian[], bolehKelola: (k: Kejadian) => boolean, sekarang = new Date()): Saran[] {
  const hasil: Saran[] = [];
  const hariIni = hariIniWib(sekarang);
  const besok = tambahHari(hariIni, 1);
  const milik = kejadian.filter((k) => k.status === "terjadwal" && bolehKelola(k));

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

/** Permintaan melihat NIK/KK lengkap yang menunggu persetujuan pengembang. */
export function saranPermintaanIdentitas(jumlah: number): Saran[] {
  if (!jumlah) return [];
  return [
    {
      kode: `permintaan-identitas:${jumlah}`,
      jenis: "peringatan",
      judul: `${jumlah} permintaan lihat NIK/KK menunggu`,
      isi: "Ada admin yang menunggu persetujuan untuk melihat nomor lengkap (berlaku 1 jam bila disetujui).",
      href: "/pengaturan/sistem",
    },
  ];
}

/** Pengembang: galat aplikasi baru yang belum dicek (pemantau galat). */
export function saranGalat(jumlah: number, kejadian: number): Saran[] {
  if (!jumlah) return [];
  return [
    {
      kode: `galat:${jumlah}:${kejadian}`,
      jenis: "peringatan",
      judul: `${jumlah} galat aplikasi belum dicek`,
      isi: `Terjadi ${kejadian}× dalam 7 hari terakhir. Rinciannya di Panel pengembang → Pemantau galat.`,
      href: "/pengaturan/sistem",
    },
  ];
}

function kelompokDan(nama: string[]): string {
  return daftarNama([...new Set(nama)], 2);
}

/**
 * Deteksi pola dari pertemuan 4 pekan terakhir yang dikelola admin ini:
 * - 3 pertemuan berturut-turut (kegiatan & wilayah yang sama) tanpa pemateri;
 * - pertemuan sering diliburkan (≥ 2 kali);
 * - absensi kosong: pertemuan 7 hari terakhir yang absensinya terbuka tapi
 *   tidak ada satu pun yang hadir (kemungkinan lupa scan).
 * `hadir`: sesi_id → jumlah catatan hadir.
 */
export function saranPola(opsi: {
  kejadian: Kejadian[];
  /** Null bila admin tidak bisa melihat absensi (pemeriksaan absensi kosong dilewati). */
  hadir: Map<string, number> | null;
  namaWilayah: (kelompokId: string | null) => string;
  bolehKelola: (k: Kejadian) => boolean;
  sekarang?: Date;
}): Saran[] {
  const sekarang = opsi.sekarang ?? new Date();
  const lalu = opsi.kejadian
    .filter((k) => opsi.bolehKelola(k) && new Date(k.selesai) < sekarang)
    .sort((a, b) => b.mulai.localeCompare(a.mulai));
  const grup = new Map<string, Kejadian[]>();
  for (const k of lalu) {
    const kunci = `${k.kegiatan.id}:${k.kelompokId ?? "desa"}`;
    grup.set(kunci, [...(grup.get(kunci) ?? []), k]);
  }
  const label = (k: Kejadian) => `${k.kegiatan.nama} (${opsi.namaWilayah(k.kelompokId)})`;
  const hasil: Saran[] = [];

  const tanpaPemateri: Kejadian[] = [];
  const seringLibur: { k: Kejadian; n: number }[] = [];
  for (const daftar of grup.values()) {
    const terjadwal = daftar.filter((k) => k.status === "terjadwal").slice(0, 3);
    if (terjadwal.length === 3 && terjadwal.every((k) => !k.pemateri)) tanpaPemateri.push(terjadwal[0]);
    const libur = daftar.filter((k) => k.status === "dibatalkan").length;
    if (libur >= 2) seringLibur.push({ k: daftar[0], n: libur });
  }
  if (tanpaPemateri.length) {
    hasil.push({
      kode: `pola-tanpa-pemateri:${tanpaPemateri.map((k) => k.kunci).join(",")}`,
      jenis: "saran",
      judul:
        tanpaPemateri.length === 1
          ? `3 pertemuan terakhir ${label(tanpaPemateri[0])} tanpa pemateri tercatat`
          : `${tanpaPemateri.length} kegiatan: 3 pertemuan terakhir tanpa pemateri tercatat`,
      isi: `${tanpaPemateri.length > 1 ? `${daftarNama(tanpaPemateri.map(label))}. ` : ""}Bila pematerinya ada, isi di halaman pertemuan supaya rekap pengajar lengkap; bila memang kosong, perlu dibicarakan bersama pengurus.`,
      href: hrefPertemuan(tanpaPemateri[0]),
    });
  }
  if (seringLibur.length) {
    const s = seringLibur.sort((a, b) => b.n - a.n)[0];
    hasil.push({
      kode: `pola-libur:${seringLibur.map((x) => `${x.k.kunci}:${x.n}`).join(",")}`,
      jenis: "saran",
      judul:
        seringLibur.length === 1
          ? `${label(s.k)} diliburkan ${s.n}× dalam 4 pekan`
          : `${seringLibur.length} kegiatan sering diliburkan dalam 4 pekan`,
      isi: `${seringLibur.length > 1 ? `${daftarNama(seringLibur.map((x) => `${label(x.k)} ${x.n}×`))}. ` : ""}Mungkin jadwalnya perlu ditinjau ulang bersama pengurus.`,
      href: `/kegiatan/kelola/${s.k.kegiatan.id}`,
    });
  }

  const sepekan = new Date(sekarang.getTime() - 7 * 24 * 3600_000);
  const hadir = opsi.hadir;
  const kosong = hadir
    ? lalu.filter(
        (k) =>
          k.status === "terjadwal" &&
          k.sesiId &&
          new Date(k.mulai) >= sepekan &&
          // Jendela scan (maks. 60 menit setelah selesai) sudah lewat.
          new Date(k.selesai).getTime() + 3600_000 < sekarang.getTime() &&
          !hadir.get(k.sesiId),
      )
    : [];
  if (kosong.length) {
    hasil.push({
      kode: `pola-absensi-kosong:${kosong.map((k) => k.kunci).join(",")}`,
      jenis: "peringatan",
      judul:
        kosong.length === 1
          ? `Absensi ${label(kosong[0])} kosong`
          : `${kosong.length} pertemuan sepekan terakhir absensinya kosong`,
      isi: `Tidak ada satu pun yang tercatat hadir${kosong.length > 1 ? ` (${kelompokDan(kosong.map(label))})` : ""}. Bila lupa scan, kehadiran masih bisa dicatat di halaman pertemuannya.`,
      href: hrefPertemuan(kosong[0]),
    });
  }
  return hasil;
}

/**
 * Pengajar rutin (aktif) yang lama tidak mengisi: terakhir mengisi lebih
 * dari `pekan` pekan lalu (atau belum pernah, bila sudah terdaftar selama
 * itu). `terakhir`: id pengajar → tanggal terakhir mengisi ("YYYY-MM-DD").
 */
export function saranPengajar(opsi: {
  pengajar: { id: string; nama: string; created_at: string }[];
  terakhir: Map<string, string>;
  pekan?: number;
  sekarang?: Date;
}): Saran[] {
  const pekan = opsi.pekan ?? 6;
  const batas = tambahHari(hariIniWib(opsi.sekarang), -pekan * 7);
  const lama = opsi.pengajar.filter((p) => {
    const t = opsi.terakhir.get(p.id);
    return t ? t < batas : hariIniWib(new Date(p.created_at)) < batas;
  });
  if (!lama.length) return [];
  return [
    {
      kode: `pengajar-lama:${lama.map((p) => p.id).sort().join(",")}`,
      jenis: "saran",
      judul:
        lama.length === 1
          ? `${lama[0].nama} belum mengisi ${pekan} pekan terakhir`
          : `${lama.length} pengajar belum mengisi ${pekan} pekan terakhir`,
      isi: `${lama.length > 1 ? `${daftarNama(lama.map((p) => p.nama))}. ` : ""}Mungkin perlu dijadwalkan lagi, atau ditanyakan kabarnya. Bila sudah tidak aktif mengajar, bisa dinonaktifkan di daftar pengajar.`,
      href: "/kegiatan/pengajar",
    },
  ];
}

/** Kunci pembanding nama: huruf kecil, tanpa tanda baca & spasi ganda. */
export function kunciNama(nama: string): string {
  return nama
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kemungkinan data ganda: jamaah aktif dengan nama sama (setelah
 * dirapikan) dan tanggal lahir sama (atau tahun lahir sama bila tanggalnya
 * kosong). Biasanya hasil impor dobel atau jamaah pindah kelompok yang
 * didaftarkan ulang.
 */
export function saranDataGanda(
  jamaah: { id: string; nama_lengkap: string; tanggal_lahir: string | null; tahun_lahir: number | null }[],
): Saran[] {
  const grup = new Map<string, typeof jamaah>();
  for (const j of jamaah) {
    const lahir = j.tanggal_lahir ?? (j.tahun_lahir ? String(j.tahun_lahir) : null);
    if (!lahir) continue;
    const kunci = `${kunciNama(j.nama_lengkap)}|${lahir}`;
    grup.set(kunci, [...(grup.get(kunci) ?? []), j]);
  }
  const ganda = [...grup.values()].filter((g) => g.length > 1);
  if (!ganda.length) return [];
  return [
    {
      kode: `data-ganda:${ganda.map((g) => g.map((j) => j.id).sort().join("+")).join(",")}`,
      jenis: "peringatan",
      judul: `${ganda.length} kemungkinan data jamaah ganda`,
      isi: `Nama & tanggal lahir sama: ${daftarNama(ganda.map((g) => `${g[0].nama_lengkap} (${g.length}×)`))}. Mohon diperiksa; bila memang dobel, salah satunya bisa dinonaktifkan atau dihapus.`,
      href: `/jamaah?q=${encodeURIComponent(ganda[0][0].nama_lengkap)}`,
    },
  ];
}

/** Awal bulan (tanggal 1–7): laporan bulan lalu siap dicetak untuk pengurus. */
export function saranLaporanBulanan(sekarang = new Date()): Saran[] {
  const hariIni = hariIniWib(sekarang);
  if (Number(hariIni.slice(8, 10)) > 7) return [];
  const [t, b] = hariIni.split("-").map(Number);
  const lalu = b === 1 ? `${t - 1}-12` : `${t}-${String(b - 1).padStart(2, "0")}`;
  return [
    {
      kode: `laporan-bulanan:${lalu}`,
      jenis: "pengingat",
      judul: `Laporan ${namaBulan(lalu)} siap`,
      isi: "Ringkasan kehadiran, kegiatan, pengajar, dan tindak lanjut bulan lalu, siap dicetak untuk musyawarah pengurus.",
      href: `/cetak/laporan?bulan=${lalu}`,
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
      isi: "Generus menunggu jawaban. Yang disetujui otomatis tercatat di absensi.",
      href: "/absensi/izin",
    },
  ];
}

/**
 * Dari laporan kehadiran 3 bulan: siapa yang perlu disapa, kelompok yang
 * turun dua bulan berturut-turut, dan apresiasi bila naik / ada yang rajin.
 */
export function saranLaporan(l: Laporan, sudahDisapa: Set<string> = new Set()): Saran[] {
  const hasil: Saran[] = [];
  // Yang sudah disapa (14 hari terakhir) tidak diingatkan lagi.
  const sapa = l.jamaah.filter((b) => b.status === "perlu_disapa" && !sudahDisapa.has(b.id));
  if (sapa.length) {
    hasil.push({
      kode: `perlu-disapa:${sapa.length}`,
      jenis: "saran",
      judul: `${sapa.length} jamaah perlu disapa`,
      isi: `Tidak hadir 3 pertemuan terakhir berturut-turut: ${daftarNama(sapa.map((b) => b.nama))}. Mungkin sedang ada kendala; sapaan hangat bisa membantu, lalu catat hasilnya di Laporan.`,
      href: "/absensi/laporan?status=perlu_disapa",
    });
  }

  // Deteksi dini: mulai jarang hadir (2 dari 4 terakhir), sebelum jadi "perlu disapa".
  const mulai = l.jamaah.filter((b) => b.status === "mulai_jarang" && !sudahDisapa.has(b.id));
  if (mulai.length) {
    hasil.push({
      kode: `mulai-jarang:${mulai.map((b) => b.id).sort().join(",")}`,
      jenis: "saran",
      judul: `${mulai.length} jamaah mulai jarang hadir`,
      isi: `2 dari 4 pertemuan terakhir tidak hadir, padahal sebelumnya rajin: ${daftarNama(mulai.map((b) => b.nama))}. Mungkin baik disapa lebih awal, sebelum menjadi kebiasaan.`,
      href: "/absensi/laporan?status=mulai_jarang",
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
  /** PIN dikembalikan admin ke PIN awal dalam 14 hari terakhir (riwayat_pin). */
  pinDikembalikan?: { id: string; created_at: string } | null;
  sekarang?: Date;
}): Saran[] {
  const hasil: Saran[] = [];
  if (opsi.pinDikembalikan) {
    const tgl = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" }).format(
      new Date(opsi.pinDikembalikan.created_at),
    );
    hasil.push({
      kode: `pin:${opsi.pinDikembalikan.id}`,
      jenis: "pengingat",
      judul: "PIN-mu dikembalikan ke PIN awal",
      isi: `Pada ${tgl}, admin mengembalikan PIN-mu ke tanggal lahir (DDMMYY). Bila bukan atas permintaanmu, mohon sampaikan ke admin kelompok.`,
      href: "/saya/pin",
    });
  }
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
      isi: `Boleh dilengkapi bila sempat: ${kurang.join(", ")}, supaya pengurus memiliki data yang benar dan mudah menghubungimu.`,
      href: hanyaAlamat ? "/saya/alamat" : "/saya/profil",
    });
  }
  return hasil;
}
