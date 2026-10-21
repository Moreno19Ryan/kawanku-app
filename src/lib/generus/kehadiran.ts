/**
 * Ringkasan kehadiran generus sendiri (beranda & halaman Kehadiran):
 * persentase bulan ini, rentetan hadir, lencana, dan sapaan. Fungsi murni
 * dari hasil RPC kehadiran_saya(); semua bulan dihitung dalam WIB.
 */

export type StatusKehadiran = "hadir" | "izin" | "sakit" | "alpa" | "berjalan";

export type CatatanKehadiran = {
  sesi_id: string;
  nama: string;
  mulai: string;
  status: StatusKehadiran;
  alasan_izin: string | null;
};

export type Lencana = {
  kode: string;
  judul: string;
  keterangan: string;
  ikon: "api" | "medali" | "bintang" | "janji";
};

export type RingkasanKehadiran = {
  bulanIni: { hadir: number; izin: number; sakit: number; alpa: number; total: number; persen: number | null };
  /** Hadir berturut-turut dari pertemuan terakhir (izin/sakit tidak memutus). */
  rentetan: number;
  totalHadir: number;
  lencana: Lencana[];
  sapaan: string;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10" (WIB). */
export function bulanWib(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 7);
}

function bulanSebelum(bulan: string): string {
  const [t, b] = bulan.split("-").map(Number);
  return b === 1 ? `${t - 1}-12` : `${t}-${String(b - 1).padStart(2, "0")}`;
}

const namaBulan = (bulan: string) => BULAN[Number(bulan.slice(5, 7)) - 1];

export function ringkasKehadiran(catatan: CatatanKehadiran[], sekarang = new Date()): RingkasanKehadiran {
  // Urut terbaru dulu; sesi yang masih berjalan tanpa catatan belum dinilai.
  const selesai = [...catatan]
    .sort((a, b) => b.mulai.localeCompare(a.mulai))
    .filter((c) => c.status !== "berjalan");
  const ini = bulanWib(sekarang.toISOString());
  const lalu = bulanSebelum(ini);

  const hitung = (bulan: string) => {
    const isi = selesai.filter((c) => bulanWib(c.mulai) === bulan);
    const n = (s: StatusKehadiran) => isi.filter((c) => c.status === s).length;
    const hadir = n("hadir");
    return { hadir, izin: n("izin"), sakit: n("sakit"), alpa: n("alpa"), total: isi.length,
      persen: isi.length ? Math.round((hadir / isi.length) * 100) : null };
  };
  const bulanIni = hitung(ini);
  const bulanLalu = hitung(lalu);

  let rentetan = 0;
  for (const c of selesai) {
    if (c.status === "hadir") rentetan++;
    else if (c.status === "alpa") break;
  }
  const totalHadir = selesai.filter((c) => c.status === "hadir").length;

  const lencana: Lencana[] = [];
  const tingkatRentetan = [10, 5, 3].find((t) => rentetan >= t);
  if (tingkatRentetan) {
    lencana.push({
      kode: `rentetan-${tingkatRentetan}`,
      judul: `${rentetan}× beruntun`,
      keterangan: `Hadir ${rentetan} pertemuan berturut-turut`,
      ikon: "api",
    });
  }
  if (bulanLalu.total >= 2 && bulanLalu.hadir === bulanLalu.total) {
    lencana.push({
      kode: "hadir-penuh",
      judul: `Penuh ${namaBulan(lalu)}`,
      keterangan: `Hadir di semua pertemuan bulan ${namaBulan(lalu)}`,
      ikon: "medali",
    });
  }
  const tingkatTotal = [100, 50, 25, 10].find((t) => totalHadir >= t);
  if (tingkatTotal) {
    lencana.push({
      kode: `total-${tingkatTotal}`,
      judul: `${tingkatTotal}+ kehadiran`,
      keterangan: `Sudah hadir ${totalHadir} kali`,
      ikon: "bintang",
    });
  }
  if (bulanIni.total >= 3 && bulanIni.alpa === 0 && bulanIni.izin + bulanIni.sakit > 0) {
    lencana.push({
      kode: "amanah",
      judul: "Amanah",
      keterangan: "Selalu memberi kabar bila berhalangan",
      ikon: "janji",
    });
  }

  let sapaan: string;
  if (selesai.length === 0) {
    sapaan = "Selamat datang! Kehadiranmu akan tercatat di sini setelah pengajian pertama.";
  } else if (selesai[0].status === "alpa") {
    sapaan = "Pertemuan terakhir terlewat. InsyaAllah hadir di pengajian berikutnya, ya. Kami menunggumu 🤗";
  } else if (rentetan >= 3) {
    sapaan = `MasyaAllah, ${rentetan} pertemuan berturut-turut! Pertahankan, ya.`;
  } else if (bulanIni.persen !== null && bulanIni.persen >= 80) {
    sapaan = `Alhamdulillah, kehadiranmu bulan ini ${bulanIni.persen}%. Luar biasa!`;
  } else {
    sapaan = "Alhamdulillah, terus semangat ngajinya!";
  }

  return { bulanIni, rentetan, totalHadir, lencana, sapaan };
}

/** Label & nada badge untuk satu catatan riwayat. */
export function labelKehadiran(c: Pick<CatatanKehadiran, "status" | "alasan_izin">): {
  label: string;
  nada: "sukses" | "netral" | "bahaya" | "utama";
} {
  switch (c.status) {
    case "hadir":
      return { label: "Hadir", nada: "sukses" };
    case "izin":
      return { label: `Izin${c.alasan_izin ? ` (${c.alasan_izin})` : ""}`, nada: "netral" };
    case "sakit":
      return { label: "Sakit", nada: "netral" };
    case "alpa":
      return { label: "Terlewat", nada: "bahaya" };
    default:
      return { label: "Berlangsung", nada: "utama" };
  }
}
