/**
 * Laporan & monitoring kehadiran (Fase 3b): tren bulanan, per kelompok,
 * per kegiatan, per kategori, status tiap jamaah, dan sorotan otomatis.
 * Fungsi murni (tanpa database), dipakai server; semua bulan dalam WIB.
 */

import { ucapanSyukur } from "@/lib/label";

export type SesiLaporan = {
  id: string;
  nama: string;
  kelompok_id: string | null;
  hanya_generus: boolean;
  mulai: string;
  selesai: string | null;
  ditutup: boolean;
};

export type JamaahLaporan = {
  id: string;
  kode: string;
  nama_lengkap: string;
  kelompok_id: string;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
  /** Sesi sebelum profil dibuat (−1 hari) tidak dihitung, kecuali ada catatannya. */
  created_at: string;
};

export type CatatanLaporan = { sesi_id: string; jamaah_id: string; status: "hadir" | "izin" | "sakit" };

export type StatusJamaah = "perlu_disapa" | "menurun" | "mulai_jarang" | "jarang" | "rajin" | "biasa";

export type BarisJamaah = {
  id: string;
  nama: string;
  kode: string;
  kelompok: string;
  kategori: string | null;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  kesempatan: number;
  persen: number | null;
  /** Selisih % hadir paruh akhir − paruh awal (poin); null bila < 4 kesempatan. */
  tren: number | null;
  /** Mulai sesi terakhir yang dihadiri. */
  terakhirHadir: string | null;
  status: StatusJamaah;
};

export type TitikBulan = { bulan: string; hadir: number; kesempatan: number; pertemuan: number; persen: number | null };

export type Laporan = {
  bulan: string[];
  ringkas: {
    persen: number | null;
    pertemuan: number;
    kehadiran: number;
    kesempatan: number;
    dipantau: number;
    rajin: number;
    perluDisapa: number;
    menurun: number;
  };
  /** Total per bulan. */
  tren: TitikBulan[];
  /** Per kelompok per bulan (hanya bila lebih dari satu kelompok). */
  seri: { id: string; nama: string; titik: TitikBulan[]; persen: number | null }[];
  perKegiatan: { nama: string; pertemuan: number; persen: number | null }[];
  perKategori: { nama: string; jumlah: number; persen: number | null }[];
  jamaah: BarisJamaah[];
  sorotan: string[];
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** "2026-10" (WIB). */
export function bulanWib(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 7);
}

export function namaBulan(bulan: string, pendek = false): string {
  const nama = BULAN[Number(bulan.slice(5, 7)) - 1];
  return pendek ? nama.slice(0, 3) : `${nama} ${bulan.slice(0, 4)}`;
}

/** n bulan terakhir (WIB), terlama dulu, termasuk bulan ini. */
export function daftarBulan(n: number, sekarang = new Date()): string[] {
  const [t, b] = bulanWib(sekarang.toISOString()).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const total = t * 12 + (b - 1) - (n - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

/** Sesi dinilai bila sudah ditutup atau sudah lewat (selesai, atau 3 jam setelah mulai). */
export function sesiSelesai(s: SesiLaporan, sekarang = new Date()): boolean {
  if (s.ditutup) return true;
  const batas = s.selesai ? new Date(s.selesai) : new Date(new Date(s.mulai).getTime() + 3 * 3600_000);
  return batas < sekarang;
}

function daftarNama(nama: string[], maks = 4): string {
  if (nama.length <= maks) return nama.join(", ");
  return `${nama.slice(0, maks).join(", ")}, dan ${nama.length - maks} lainnya`;
}

/**
 * Deteksi dini "mulai jarang hadir": minimal 2 dari 4 pertemuan terakhir
 * tidak hadir tanpa keterangan (izin/sakit tidak dihitung), padahal
 * sebelumnya cukup rajin (≥ 60% bila ada riwayat, selain itu belum kronis).
 * jejak = H/I/S/A urut waktu. Murni.
 */
export function mulaiJarang(jejak: string[]): boolean {
  if (jejak.length < 4) return false;
  const akhir = jejak.slice(-4);
  if (akhir.filter((x) => x === "A").length < 2) return false;
  const awal = jejak.slice(0, -4);
  const hadir = (xs: string[]) => xs.filter((x) => x === "H").length / xs.length;
  return awal.length >= 2 ? hadir(awal) >= 0.6 : hadir(jejak) >= 0.4;
}

export function hitungLaporan(opsi: {
  sesi: SesiLaporan[];
  jamaah: JamaahLaporan[];
  catatan: CatatanLaporan[];
  namaKelompok: Map<string, string>;
  /** Nama kegiatan untuk sesi yang dibuka dari kalender (sesi_id → nama kegiatan). */
  kegiatanSesi: Map<string, string>;
  bulan: string[];
  sekarang?: Date;
}): Laporan {
  const sekarang = opsi.sekarang ?? new Date();
  const sesi = opsi.sesi.filter((s) => sesiSelesai(s, sekarang)).sort((a, b) => a.mulai.localeCompare(b.mulai));
  const peta = new Map(opsi.catatan.map((c) => [`${c.sesi_id}:${c.jamaah_id}`, c.status]));
  const kosong = (bulan: string): TitikBulan => ({ bulan, hadir: 0, kesempatan: 0, pertemuan: 0, persen: null });

  const tren = new Map(opsi.bulan.map((b) => [b, kosong(b)]));
  const kelompokIds = [...new Set(opsi.jamaah.map((j) => j.kelompok_id))];
  const perKelompok = new Map(kelompokIds.map((k) => [k, new Map(opsi.bulan.map((b) => [b, kosong(b)]))]));
  const kegiatan = new Map<string, { pertemuan: Set<string>; hadir: number; kesempatan: number }>();
  const kategori = new Map<string, { jamaah: Set<string>; hadir: number; kesempatan: number }>();
  // Hanya sesi di dalam rentang bulan yang dinilai.
  const sesiDalam = sesi.filter((s) => tren.has(bulanWib(s.mulai)));
  for (const s of sesiDalam) tren.get(bulanWib(s.mulai))!.pertemuan++;

  const jamaah: BarisJamaah[] = opsi.jamaah.map((j) => {
    const jejak: ("H" | "I" | "S" | "A")[] = [];
    const b: BarisJamaah = {
      id: j.id,
      nama: j.nama_lengkap,
      kode: j.kode,
      kelompok: opsi.namaKelompok.get(j.kelompok_id) ?? "",
      kategori: j.kategori_jamaah_nama,
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpa: 0,
      kesempatan: 0,
      persen: null,
      tren: null,
      terakhirHadir: null,
      status: "biasa",
    };
    const sejak = new Date(new Date(j.created_at).getTime() - 24 * 3600_000).toISOString();
    for (const s of sesiDalam) {
      const status = peta.get(`${s.id}:${j.id}`);
      const peserta =
        Boolean(status) ||
        ((s.kelompok_id === null || s.kelompok_id === j.kelompok_id) &&
          (!s.hanya_generus || j.termasuk_generus) &&
          s.mulai >= sejak);
      if (!peserta) continue;
      const bulan = bulanWib(s.mulai);
      const hadir = status === "hadir" ? 1 : 0;
      b.kesempatan++;
      if (status === "hadir") {
        b.hadir++;
        b.terakhirHadir = s.mulai;
      } else if (status === "izin") b.izin++;
      else if (status === "sakit") b.sakit++;
      else b.alpa++;
      jejak.push(status === "hadir" ? "H" : status === "izin" ? "I" : status === "sakit" ? "S" : "A");

      const t = tren.get(bulan)!;
      t.hadir += hadir;
      t.kesempatan++;
      const k = perKelompok.get(j.kelompok_id)!.get(bulan)!;
      k.hadir += hadir;
      k.kesempatan++;
      const namaKeg = opsi.kegiatanSesi.get(s.id) ?? s.nama;
      const g = kegiatan.get(namaKeg) ?? { pertemuan: new Set<string>(), hadir: 0, kesempatan: 0 };
      g.pertemuan.add(s.id);
      g.hadir += hadir;
      g.kesempatan++;
      kegiatan.set(namaKeg, g);
      const namaKat = j.kategori_jamaah_nama ?? "Tanpa kategori";
      const c = kategori.get(namaKat) ?? { jamaah: new Set<string>(), hadir: 0, kesempatan: 0 };
      c.jamaah.add(j.id);
      c.hadir += hadir;
      c.kesempatan++;
      kategori.set(namaKat, c);
    }
    b.persen = persen(b.hadir, b.kesempatan);
    if (jejak.length >= 4) {
      const tengah = Math.floor(jejak.length / 2);
      const p = (xs: string[]) => persen(xs.filter((x) => x === "H").length, xs.length) ?? 0;
      b.tren = p(jejak.slice(tengah)) - p(jejak.slice(0, tengah));
    }
    // Urutan prioritas: yang paling perlu perhatian lebih dulu.
    if (jejak.length >= 3 && jejak.slice(-3).every((x) => x === "A")) b.status = "perlu_disapa";
    else if (b.tren !== null && b.tren <= -25) b.status = "menurun";
    else if (mulaiJarang(jejak)) b.status = "mulai_jarang";
    else if (b.kesempatan >= 4 && (b.persen ?? 0) < 40) b.status = "jarang";
    else if (b.kesempatan >= 4 && (b.persen ?? 0) >= 85) b.status = "rajin";
    return b;
  });

  const dipantau = jamaah.filter((b) => b.kesempatan > 0);
  const kehadiran = dipantau.reduce((n, b) => n + b.hadir, 0);
  const kesempatan = dipantau.reduce((n, b) => n + b.kesempatan, 0);
  const isiPersen = (t: TitikBulan): TitikBulan => ({ ...t, persen: persen(t.hadir, t.kesempatan) });
  const titikTren = opsi.bulan.map((b) => isiPersen(tren.get(b)!));
  const seri =
    kelompokIds.length > 1
      ? kelompokIds
          .map((id) => {
            const titik = opsi.bulan.map((b) => isiPersen(perKelompok.get(id)!.get(b)!));
            return {
              id,
              nama: opsi.namaKelompok.get(id) ?? "Kelompok",
              titik,
              persen: persen(
                titik.reduce((n, t) => n + t.hadir, 0),
                titik.reduce((n, t) => n + t.kesempatan, 0),
              ),
            };
          })
          .sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }))
      : [];
  const perKegiatan = [...kegiatan.entries()]
    .map(([nama, g]) => ({ nama, pertemuan: g.pertemuan.size, persen: persen(g.hadir, g.kesempatan) }))
    .sort((a, b) => b.pertemuan - a.pertemuan);
  const perKategori = [...kategori.entries()]
    .map(([nama, c]) => ({ nama, jumlah: c.jamaah.size, persen: persen(c.hadir, c.kesempatan) }))
    .sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1));
  const urutStatus: Record<StatusJamaah, number> = { perlu_disapa: 0, menurun: 1, mulai_jarang: 2, jarang: 3, biasa: 4, rajin: 5 };
  jamaah.sort(
    (a, b) => urutStatus[a.status] - urutStatus[b.status] || (a.persen ?? 101) - (b.persen ?? 101) || a.nama.localeCompare(b.nama, "id"),
  );

  const hitungStatus = (s: StatusJamaah) => dipantau.filter((b) => b.status === s).length;
  const ringkas = {
    persen: persen(kehadiran, kesempatan),
    pertemuan: sesiDalam.length,
    kehadiran,
    kesempatan,
    dipantau: dipantau.length,
    rajin: hitungStatus("rajin"),
    perluDisapa: hitungStatus("perlu_disapa"),
    menurun: hitungStatus("menurun"),
    mulaiJarang: hitungStatus("mulai_jarang"),
  };

  // --- Sorotan otomatis -------------------------------------------------------
  const sorotan: string[] = [];
  if (sesiDalam.length === 0) {
    sorotan.push("Belum ada pertemuan yang tercatat di rentang ini. Sorotan muncul setelah absensi berjalan.");
  } else {
    sorotan.push(
      `Rata-rata kehadiran ${ringkas.persen}% dari ${sesiDalam.length} pertemuan dalam ${opsi.bulan.length} bulan terakhir.`,
    );
    const berisi = titikTren.filter((t) => t.persen !== null);
    if (berisi.length >= 2) {
      const [lalu, kini] = berisi.slice(-2);
      const d = kini.persen! - lalu.persen!;
      sorotan.push(
        d === 0
          ? `${namaBulan(kini.bulan)} sama dengan ${namaBulan(lalu.bulan)} (${kini.persen}%).`
          : `${namaBulan(kini.bulan)} ${d > 0 ? "naik" : "turun"} ${Math.abs(d)} poin dibanding ${namaBulan(lalu.bulan)} (${lalu.persen}% → ${kini.persen}%).${d > 0 ? " Alhamdulillah." : ""}`,
      );
    }
    const seriBerisi = seri.filter((s) => s.persen !== null);
    if (seriBerisi.length > 1) {
      const atas = seriBerisi.reduce((a, b) => (b.persen! > a.persen! ? b : a));
      const bawah = seriBerisi.reduce((a, b) => (b.persen! < a.persen! ? b : a));
      if (atas.id !== bawah.id) {
        sorotan.push(`${atas.nama} paling rajin (${atas.persen}%); ${bawah.nama} perlu dukungan (${bawah.persen}%).`);
      }
    }
    const kegBerisi = perKegiatan.filter((k) => k.persen !== null && k.pertemuan >= 2);
    if (kegBerisi.length > 1) {
      const atas = kegBerisi.reduce((a, b) => (b.persen! > a.persen! ? b : a));
      const bawah = kegBerisi.reduce((a, b) => (b.persen! < a.persen! ? b : a));
      if (atas.persen !== bawah.persen) sorotan.push(`Kegiatan paling ramai: ${atas.nama} (${atas.persen}%). Paling sepi: ${bawah.nama} (${bawah.persen}%).`);
    }
    const katBerisi = perKategori.filter((k) => k.persen !== null && k.jumlah >= 3);
    if (katBerisi.length > 1) {
      const bawah = katBerisi[katBerisi.length - 1];
      sorotan.push(`Kategori dengan kehadiran terendah: ${bawah.nama} (${bawah.persen}%). Mungkin perlu pendekatan khusus.`);
    }
    const sapa = jamaah.filter((b) => b.status === "perlu_disapa").map((b) => b.nama);
    if (sapa.length) {
      sorotan.push(`${sapa.length} jamaah tidak hadir 3 pertemuan terakhir berturut-turut: ${daftarNama(sapa)}. Yuk disapa pekan ini.`);
    }
    if (ringkas.menurun) sorotan.push(`${ringkas.menurun} jamaah kehadirannya menurun tajam dibanding awal periode.`);
    if (ringkas.mulaiJarang) {
      sorotan.push(`${ringkas.mulaiJarang} jamaah mulai jarang hadir (2 dari 4 pertemuan terakhir tidak hadir). Mungkin baik disapa lebih awal, sebelum menjadi kebiasaan.`);
    }
    if (ringkas.rajin) sorotan.push(`MasyaAllah, ${ringkas.rajin} jamaah hadir minimal 85% pertemuan.`);
    if (kehadiran > 0) sorotan.push(`${ucapanSyukur()} atas kehadiran para jamaah.`);
  }

  return {
    bulan: opsi.bulan,
    ringkas,
    tren: titikTren,
    seri,
    perKegiatan,
    perKategori,
    jamaah: jamaah.filter((b) => b.kesempatan > 0),
    sorotan,
  };
}
