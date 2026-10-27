/**
 * Label tampilan Jejak aktivitas (murni): nama tabel & kolom dalam bahasa
 * sehari-hari, dan pengelompokan untuk saringan.
 */

export const KELOMPOK_TABEL: Record<string, { judul: string; tabel: string[] }> = {
  jamaah: {
    judul: "Data jamaah",
    tabel: [
      "jamaah", "jamaah_identitas", "jamaah_janda_duda", "jamaah_keringanan", "jamaah_kontak",
      "jamaah_pribadi", "keluarga", "usulan_koreksi",
    ],
  },
  absensi: { judul: "Absensi & izin", tabel: ["absensi", "kartu_qr", "pengajuan_izin"] },
  kegiatan: {
    judul: "Kegiatan",
    tabel: ["kegiatan", "kegiatan_jadwal", "pertemuan", "pertemuan_materi", "pengajar", "pengumuman"],
  },
  akun: { judul: "Akun & akses", tabel: ["admin", "akun_generus", "penugasan_peran", "peran", "peran_izin"] },
  sistem: {
    judul: "Pengaturan & sistem",
    tabel: ["pengaturan_sistem", "fitur", "fitur_kelompok", "kelompok", "kategori_jamaah", "cadangan_jadwal"],
  },
};

const NAMA_TABEL: Record<string, string> = {
  jamaah: "Jamaah",
  jamaah_identitas: "NIK & No. KK",
  jamaah_janda_duda: "Keterangan janda/duda",
  jamaah_keringanan: "Keringanan",
  jamaah_kontak: "Kontak jamaah",
  jamaah_pribadi: "Data pribadi jamaah",
  keluarga: "Keluarga",
  usulan_koreksi: "Laporan koreksi",
  absensi: "Absensi",
  kartu_qr: "Kartu QR",
  pengajuan_izin: "Izin/sakit",
  kegiatan: "Kegiatan",
  kegiatan_jadwal: "Jadwal kegiatan",
  pertemuan: "Pertemuan",
  pertemuan_materi: "Pemateri & materi",
  pengajar: "Pengajar",
  pengumuman: "Pengumuman",
  admin: "Akun admin",
  akun_generus: "Akun generus",
  penugasan_peran: "Peran admin",
  peran: "Peran",
  peran_izin: "Izin peran",
  pengaturan_sistem: "Pengaturan sistem",
  fitur: "Saklar fitur",
  fitur_kelompok: "Saklar fitur per kelompok",
  kelompok: "Kelompok",
  kategori_jamaah: "Kategori jamaah",
  cadangan_jadwal: "Jadwal cadangan",
};

export function namaTabel(tabel: string): string {
  return NAMA_TABEL[tabel] ?? tabel.replaceAll("_", " ");
}

export const NAMA_AKSI: Record<string, string> = { insert: "Tambah", update: "Ubah", delete: "Hapus" };

/** "tahun_lahir" → "tahun lahir"; kolom yang lazim diberi nama yang lebih jelas. */
const NAMA_KOLOM: Record<string, string> = {
  nama_lengkap: "nama lengkap",
  kelompok_id: "kelompok",
  keluarga_id: "keluarga",
  status_pernikahan: "status pernikahan",
  status_sekolah: "status sekolah",
  no_hp: "no. HP",
  no_hp_wali: "no. HP wali",
  nik: "NIK",
  no_kk: "No. KK",
  aktif: "aktif/nonaktif",
  mode_perawatan: "mode perawatan",
  pemateri_nama: "pemateri",
};

export function namaKolom(kolom: string): string {
  return NAMA_KOLOM[kolom] ?? kolom.replace(/_id$/, "").replaceAll("_", " ");
}

/** Awal rentang waktu saringan (ISO), `hari` ke belakang dari sekarang. */
export function sejakHari(hari: number, sekarang = Date.now()): string {
  return new Date(sekarang - hari * 86_400_000).toISOString();
}
