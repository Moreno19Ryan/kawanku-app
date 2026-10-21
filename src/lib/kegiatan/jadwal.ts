/**
 * Kalender kegiatan: menghitung pertemuan dari aturan jadwal rutin
 * (hari, jam, kecuali pekan ke-N), lalu menggabungkan baris pertemuan yang
 * tersimpan (pemateri, materi, batal, pindah jam, absensi). Fungsi murni;
 * dipakai server (halaman) dan bisa diuji tanpa database. Semua tanggal WIB.
 */

export type Kegiatan = {
  id: string;
  nama: string;
  jenis: "rutin" | "agenda";
  kelompok_id: string | null;
  per_kelompok: boolean;
  hanya_generus: boolean;
  lokasi: string | null;
  keterangan: string | null;
  durasi_menit: number;
  aktif: boolean;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
};

export type Jadwal = { id: string; kegiatan_id: string; hari: number; jam: string; kecuali_pekan_ke: number[] };

export type PertemuanTersimpan = {
  id: string;
  kegiatan_id: string;
  kelompok_id: string | null;
  tanggal: string;
  mulai: string;
  status: "terjadwal" | "dibatalkan";
  alasan_batal: string | null;
  pemateri_jamaah_id: string | null;
  pemateri_nama: string | null;
  materi: string | null;
  catatan: string | null;
  sesi_id: string | null;
};

export type Kejadian = {
  /** kegiatan:kelompok:tanggal, kunci unik di kalender. */
  kunci: string;
  kegiatan: Kegiatan;
  kelompokId: string | null;
  tanggal: string;
  mulai: string;
  selesai: string;
  /** Waktu dari jadwal (sebelum dipindah). */
  mulaiJadwal: string;
  dipindah: boolean;
  status: "terjadwal" | "dibatalkan";
  alasanBatal: string | null;
  pemateri: string | null;
  pemateriJamaahId: string | null;
  materi: string | null;
  catatan: string | null;
  sesiId: string | null;
  tersimpan: PertemuanTersimpan | null;
};

export const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "YYYY-MM-DD" hari ini di WIB. */
export function hariIniWib(sekarang = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(sekarang);
}

export function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Minggu … 6 = Sabtu. */
export function hariDari(tanggal: string): number {
  return new Date(`${tanggal}T00:00:00Z`).getUTCDay();
}

/** Pekan ke-berapa dalam bulan (hari 1–7 = pekan 1, 15–21 = pekan 3, …). */
export function pekanKe(tanggal: string): number {
  return Math.ceil(Number(tanggal.slice(8, 10)) / 7);
}

export function waktuWib(tanggal: string, jam: string): string {
  return new Date(`${tanggal}T${jam.slice(0, 5)}:00+07:00`).toISOString();
}

export const kunciKejadian = (kegiatanId: string, kelompokId: string | null, tanggal: string) =>
  `${kegiatanId}:${kelompokId ?? "desa"}:${tanggal}`;

/** Ringkasan aturan jadwal, mis. "Minggu 20.00 (kecuali pekan ke-3) · Selasa 20.00". */
export function ringkasJadwal(jadwal: Jadwal[]): string {
  return [...jadwal]
    .sort((a, b) => a.hari - b.hari || a.jam.localeCompare(b.jam))
    .map(
      (j) =>
        `${NAMA_HARI[j.hari]} ${j.jam.slice(0, 5).replace(":", ".")}${
          j.kecuali_pekan_ke.length ? ` (libur pekan ke-${j.kecuali_pekan_ke.join(", ")})` : ""
        }`,
    )
    .join(" · ");
}

/**
 * Semua kejadian di rentang [dari, sampai] (inklusif) untuk kelompok yang
 * terlihat. Kegiatan serentak (per_kelompok) muncul sekali per kelompok.
 */
export function hitungKalender(opsi: {
  kegiatan: Kegiatan[];
  jadwal: Jadwal[];
  pertemuan: PertemuanTersimpan[];
  dari: string;
  sampai: string;
  /** Kelompok yang ditampilkan untuk kegiatan serentak. */
  kelompok: string[];
}): Kejadian[] {
  const { kegiatan, jadwal, pertemuan, dari, sampai, kelompok } = opsi;
  const tersimpan = new Map(pertemuan.map((p) => [kunciKejadian(p.kegiatan_id, p.kelompok_id, p.tanggal), p]));
  const hasil = new Map<string, Kejadian>();
  const petaKegiatan = new Map(kegiatan.map((k) => [k.id, k]));

  function tambah(k: Kegiatan, kelompokId: string | null, tanggal: string, mulaiJadwal: string) {
    const kunci = kunciKejadian(k.id, kelompokId, tanggal);
    const p = tersimpan.get(kunci) ?? null;
    const mulai = p?.mulai ?? mulaiJadwal;
    hasil.set(kunci, {
      kunci,
      kegiatan: k,
      kelompokId,
      tanggal,
      mulai,
      selesai: new Date(new Date(mulai).getTime() + k.durasi_menit * 60_000).toISOString(),
      mulaiJadwal,
      dipindah: Boolean(p && new Date(p.mulai).getTime() !== new Date(mulaiJadwal).getTime()),
      status: p?.status ?? "terjadwal",
      alasanBatal: p?.alasan_batal ?? null,
      pemateri: p?.pemateri_nama ?? null,
      pemateriJamaahId: p?.pemateri_jamaah_id ?? null,
      materi: p?.materi ?? null,
      catatan: p?.catatan ?? null,
      sesiId: p?.sesi_id ?? null,
      tersimpan: p,
    });
  }

  // Kegiatan rutin: dari aturan jadwal.
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) {
    const hari = hariDari(t);
    for (const j of jadwal) {
      if (j.hari !== hari || j.kecuali_pekan_ke.includes(pekanKe(t))) continue;
      const k = petaKegiatan.get(j.kegiatan_id);
      if (!k || k.jenis !== "rutin" || !k.aktif || t < k.berlaku_mulai || (k.berlaku_sampai && t > k.berlaku_sampai)) {
        continue;
      }
      const w = waktuWib(t, j.jam);
      if (k.per_kelompok) for (const kel of kelompok) tambah(k, kel, t, w);
      else tambah(k, k.kelompok_id, t, w);
    }
  }
  // Pertemuan tersimpan yang tidak dari jadwal (agenda, atau jadwal sudah berubah).
  for (const p of pertemuan) {
    const kunci = kunciKejadian(p.kegiatan_id, p.kelompok_id, p.tanggal);
    const k = petaKegiatan.get(p.kegiatan_id);
    if (hasil.has(kunci) || !k || p.tanggal < dari || p.tanggal > sampai) continue;
    if (k.per_kelompok && p.kelompok_id && !kelompok.includes(p.kelompok_id)) continue;
    tambah(k, p.kelompok_id, p.tanggal, p.mulai);
  }
  return [...hasil.values()].sort((a, b) => a.mulai.localeCompare(b.mulai) || a.kegiatan.nama.localeCompare(b.kegiatan.nama));
}
