/** Pengaturan buka/tutup absensi dari form (kegiatan & acara baru). Murni. */

const MENIT = [15, 30, 45, 60];

export type PengaturanAbsensi = {
  absensi_otomatis: boolean;
  buka_sebelum_menit: number;
  tutup_setelah_menit: number;
};

function menit(nilai: FormDataEntryValue | null): number {
  const n = Number(nilai);
  return MENIT.includes(n) ? n : 30;
}

/** Field: absensi ("otomatis" | "manual"), buka_sebelum, tutup_setelah. */
export function bacaPengaturanAbsensi(fd: FormData): PengaturanAbsensi {
  return {
    absensi_otomatis: fd.get("absensi") !== "manual",
    buka_sebelum_menit: menit(fd.get("buka_sebelum")),
    tutup_setelah_menit: menit(fd.get("tutup_setelah")),
  };
}
