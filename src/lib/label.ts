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
