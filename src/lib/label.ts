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
