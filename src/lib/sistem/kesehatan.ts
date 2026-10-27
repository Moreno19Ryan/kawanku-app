/**
 * Kesehatan sistem untuk Panel pengembang: data mentah dari RPC
 * `kesehatan_sistem()` → daftar butir hijau/kuning/merah dengan kalimat
 * yang bisa langsung ditindaklanjuti. Murni (tanpa I/O).
 */

export type Tingkat = "baik" | "perhatian" | "masalah";

export type DataTugas = {
  nama: string;
  jadwal: string;
  aktif: boolean;
  terakhir_at: string | null;
  terakhir_status: string | null;
  terakhir_pesan: string | null;
  jalan_24j: number;
  gagal_24j: number;
};

export type DataKesehatan = {
  tugas: DataTugas[];
  notifikasi: { langganan_aktif: number; terkirim_24j: number; gagal_kirim: number | null };
  cadangan: { terakhir_berhasil: string | null; gagal_7h: number };
  database_byte: number;
  galat: { baru: number; hari_ini: number };
};

export type InfoTugas = {
  judul: string;
  keterangan: string;
  jadwal: string;
  /** Selang normal antarjalan (menit), untuk mendeteksi tugas yang macet. */
  selangMenit: number;
};

/** Tugas otomatis KawanKu (pg_cron), dalam bahasa sehari-hari. */
export const INFO_TUGAS: Record<string, InfoTugas> = {
  "kawanku-buka-absensi": {
    judul: "Buka absensi",
    keterangan: "Membuka sesi absensi pertemuan yang sudah masuk waktunya.",
    jadwal: "Tiap menit",
    selangMenit: 1,
  },
  "kawanku-kirim-notifikasi": {
    judul: "Kirim notifikasi",
    keterangan: "Mengirim pengingat pengajian, ringkasan pagi, rapor, dan peringatan sistem ke HP.",
    jadwal: "Tiap 5 menit",
    selangMenit: 5,
  },
  "kawanku-cadangan": {
    judul: "Cadangan data",
    keterangan: "Membuat cadangan terenkripsi. Jalankan sekarang = membuat cadangan manual.",
    jadwal: "Tiap hari 02.00 WIB",
    selangMenit: 24 * 60,
  },
  "kawanku-tempat-sampah": {
    judul: "Kosongkan tempat sampah",
    keterangan: "Menghapus permanen data di tempat sampah yang sudah lebih dari 30 hari.",
    jadwal: "Tiap hari 03.00 WIB",
    selangMenit: 24 * 60,
  },
  "kawanku-bersihkan": {
    judul: "Bersihkan riwayat",
    keterangan: "Menghapus riwayat tugas lebih dari 7 hari, catatan notifikasi lebih dari 90 hari, dan jejak aktivitas lebih dari 180 hari.",
    jadwal: "Tiap hari 02.30 WIB",
    selangMenit: 24 * 60,
  },
};

export type Butir = { tingkat: Tingkat; judul: string; isi: string };

const BATAS_DB = 500 * 1024 * 1024;

export function ukuranMb(byte: number): string {
  return `${(byte / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 0 })} MB`;
}

/** Keadaan satu tugas: dimatikan, gagal terakhir, macet (tidak jalan melewati selangnya), atau baik. */
export function nilaiTugas(t: DataTugas, sekarang = Date.now()): Butir {
  const info = INFO_TUGAS[t.nama];
  const judul = info?.judul ?? t.nama;
  if (!t.aktif) return { tingkat: "perhatian", judul, isi: "Sedang dimatikan." };
  if (t.terakhir_status === "failed") {
    return { tingkat: "masalah", judul, isi: "Jalan terakhir gagal. Lihat pesannya di Tugas otomatis." };
  }
  const selang = info?.selangMenit ?? 60;
  if (!t.terakhir_at) {
    return selang >= 24 * 60
      ? { tingkat: "baik", judul, isi: "Belum pernah jalan (menunggu jadwal pertamanya)." }
      : { tingkat: "masalah", judul, isi: "Belum pernah jalan." };
  }
  const telatMenit = (sekarang - new Date(t.terakhir_at).getTime()) / 60000;
  // Toleransi: 3× selang untuk tugas sering, +6 jam untuk tugas harian.
  const batas = selang >= 24 * 60 ? selang + 6 * 60 : Math.max(selang * 3, 5);
  if (telatMenit > batas) return { tingkat: "masalah", judul, isi: "Tidak berjalan sesuai jadwal." };
  if (t.gagal_24j > 0) {
    return { tingkat: "perhatian", judul, isi: `Sempat gagal ${t.gagal_24j}× dalam 24 jam terakhir.` };
  }
  return { tingkat: "baik", judul, isi: "Berjalan normal." };
}

/** Semua butir kesehatan, urut dari yang paling perlu perhatian. */
export function nilaiKesehatan(d: DataKesehatan, sekarang = Date.now()): Butir[] {
  const butir: Butir[] = [];

  const tugas = d.tugas.map((t) => nilaiTugas(t, sekarang));
  const bermasalah = tugas.filter((t) => t.tingkat !== "baik");
  butir.push(
    bermasalah.length === 0
      ? { tingkat: "baik", judul: "Tugas otomatis", isi: `${tugas.length} tugas berjalan normal.` }
      : {
          tingkat: bermasalah.some((t) => t.tingkat === "masalah") ? "masalah" : "perhatian",
          judul: "Tugas otomatis",
          isi: bermasalah.map((t) => `${t.judul}: ${t.isi}`).join(" "),
        },
  );

  const n = d.notifikasi;
  butir.push(
    n.gagal_kirim
      ? {
          tingkat: "perhatian",
          judul: "Notifikasi HP",
          isi: `${n.gagal_kirim} pengiriman ke server aplikasi gagal. Periksa env NOTIFIKASI_RAHASIA & VAPID di Vercel.`,
        }
      : {
          tingkat: "baik",
          judul: "Notifikasi HP",
          isi: `${n.langganan_aktif} perangkat berlangganan, ${n.terkirim_24j} notifikasi dalam 24 jam terakhir.`,
        },
  );

  const c = d.cadangan;
  const umurCadangan = c.terakhir_berhasil ? (sekarang - new Date(c.terakhir_berhasil).getTime()) / 3600000 : null;
  butir.push(
    umurCadangan === null || umurCadangan > 36
      ? {
          tingkat: "masalah",
          judul: "Cadangan data",
          isi:
            umurCadangan === null
              ? "Belum ada cadangan yang berhasil. Buat cadangan manual di Cadangan data."
              : "Cadangan berhasil terakhir lebih dari 36 jam lalu. Buat cadangan manual dan periksa tugasnya.",
        }
      : c.gagal_7h > 0
        ? { tingkat: "perhatian", judul: "Cadangan data", isi: `${c.gagal_7h} cadangan gagal dalam 7 hari terakhir.` }
        : { tingkat: "baik", judul: "Cadangan data", isi: "Cadangan terakhir berhasil." },
  );

  const persen = Math.round((d.database_byte / BATAS_DB) * 100);
  butir.push({
    tingkat: persen >= 80 ? "masalah" : persen >= 60 ? "perhatian" : "baik",
    judul: "Ruang database",
    isi: `${ukuranMb(d.database_byte)} dari 500 MB (${persen}%).${persen >= 60 ? " Kurangi jumlah cadangan yang disimpan." : ""}`,
  });

  butir.push(
    d.galat.baru > 0
      ? { tingkat: "perhatian", judul: "Galat aplikasi", isi: `${d.galat.baru} galat belum dicek. Lihat Pemantau galat.` }
      : { tingkat: "baik", judul: "Galat aplikasi", isi: "Tidak ada galat baru." },
  );

  const urutan: Record<Tingkat, number> = { masalah: 0, perhatian: 1, baik: 2 };
  return butir.sort((a, b) => urutan[a.tingkat] - urutan[b.tingkat]);
}

/** Tingkat keseluruhan = yang terburuk. */
export function tingkatKeseluruhan(butir: Butir[]): Tingkat {
  if (butir.some((b) => b.tingkat === "masalah")) return "masalah";
  if (butir.some((b) => b.tingkat === "perhatian")) return "perhatian";
  return "baik";
}
