/**
 * Ucapan syukur/terima kasih baku (CLAUDE.md → Gaya bahasa): laki-laki
 * Jazakallahu, perempuan Jazakillahu, umum/banyak orang Jazakumullahu.
 */
export function ucapanSyukur(jenisKelamin?: string | null): string {
  if (jenisKelamin === "L") return "Alhamdulillah Jazakallahu Khoiro";
  if (jenisKelamin === "P") return "Alhamdulillah Jazakillahu Khoiro";
  return "Alhamdulillah Jazakumullahu Khoiro";
}

/** Label tampilan untuk enum database (Bahasa Indonesia). */
export const LABEL_STATUS_SEKOLAH: Record<string, string> = {
  belum_sekolah: "Belum sekolah",
  paud_tk: "PAUD/TK",
  sd: "SD",
  smp: "SMP",
  sma_smk: "SMA/SMK",
  kuliah: "Kuliah",
  bekerja: "Bekerja",
  lainnya: "Lainnya",
};

/** Rentang kelas per jenjang (SD 1–6, SMP 7–9, SMA/SMK 10–12). */
export const RENTANG_KELAS: Record<string, [number, number]> = {
  sd: [1, 6],
  smp: [7, 9],
  sma_smk: [10, 12],
};

/** "SD kelas 4", "SMA/SMK kelas 12", atau label status saja. */
export function labelSekolah(status: string | null, kelas: number | null): string {
  if (!status) return "Belum diisi";
  const label = LABEL_STATUS_SEKOLAH[status] ?? status;
  return kelas ? `${label} kelas ${kelas}` : label;
}

export const LABEL_STATUS_PERNIKAHAN: Record<string, string> = {
  lajang: "Lajang",
  menikah: "Menikah",
  janda_duda: "Janda/duda",
};

export const LABEL_WILAYAH_PERAN = {
  desa: "Seluruh desa",
  kelompok: "Satu kelompok",
  fleksibel: "Desa atau satu kelompok",
} as const;

export const LABEL_PENDIDIKAN: Record<string, string> = {
  belum_sekolah: "Belum sekolah",
  sd: "SD",
  smp: "SMP",
  sma_smk: "SMA/SMK",
  diploma: "Diploma",
  s1: "S1",
  s2: "S2",
  s3: "S3",
};

export const PAKET_CABERAWIT = ["A", "B", "C", "D", "E", "F"] as const;

/** "Muballigh" (L) / "Muballighot" (P). */
export function labelMuballigh(jenisKelamin: string): string {
  return jenisKelamin === "P" ? "Muballighot" : "Muballigh";
}

/** "Muballigh Tugasan (MT)", "Muballighot Setempat (MS)", dst. */
export function labelJenisMuballigh(jenis: string, jenisKelamin: string): string {
  const dasar = labelMuballigh(jenisKelamin);
  return jenis === "tugasan" ? `${dasar} Tugasan (MT)` : `${dasar} Setempat (MS)`;
}

export const LABEL_HUBUNGAN: Record<string, string> = {
  kepala_keluarga: "Kepala keluarga",
  pasangan: "Pasangan (suami/istri)",
  anak: "Anak",
  orang_tua: "Orang tua",
  lainnya: "Lainnya",
};

export const LABEL_STATUS_ABSENSI: Record<string, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
};

export const LABEL_ALASAN_IZIN: Record<string, string> = {
  sekolah: "Sekolah",
  kuliah: "Kuliah",
  kerja: "Kerja",
  lainnya: "Lainnya",
};

/**
 * Dokumen identitas untuk label alamat: anak di bawah 17 tahun memakai KIA
 * (Kartu Identitas Anak), selebihnya KTP. Kolom database tetap ktp_*.
 */
export function dokumenIdentitas(usia: number | null): "KIA" | "KTP" {
  return usia !== null && usia < 17 ? "KIA" : "KTP";
}

/** Bagian data yang bisa diusulkan koreksinya oleh generus (usulan_koreksi.bagian). */
export const LABEL_BAGIAN_USULAN: Record<string, string> = {
  nama_lengkap: "Nama lengkap",
  tanggal_lahir: "Tanggal lahir",
  jenis_kelamin: "Jenis kelamin",
  status_sekolah: "Status sekolah",
  pendidikan_terakhir: "Pendidikan terakhir",
  status_pernikahan: "Status pernikahan",
  kelompok: "Kelompok",
  keluarga: "Keluarga",
  lainnya: "Lainnya",
};

/** Bagian data yang diubah generus sendiri (jejak perubahan). */
export const LABEL_BAGIAN_PERUBAHAN: Record<string, string> = {
  nama_panggilan: "Nama panggilan",
  tempat_lahir: "Tempat lahir",
  tanggal_lahir: "Tanggal lahir",
  status_sekolah: "Status sekolah",
  kelas: "Kelas",
  pendidikan_terakhir: "Pendidikan terakhir",
  kegiatan: "Pekerjaan/kegiatan",
  no_hp: "No. HP",
  email: "Email",
  no_hp_wali: "No. HP wali",
  nama_ayah: "Nama ayah",
  nama_ibu: "Nama ibu",
  alamat: "Alamat",
};
