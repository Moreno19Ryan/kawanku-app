// Jendela absensi otomatis (murni; dipakai server & klien).

/**
 * Absensi serba otomatis: terbuka N menit sebelum mulai sampai N menit
 * setelah selesai, N = jendela kegiatannya (15/30/45/60, bawaan 30; sama
 * dengan private.waktu_scan_sesi & trigger cek_waktu_sesi). Database
 * membukanya sendiri tiap menit (pg_cron, private.buka_absensi_otomatis).
 */
export const PILIHAN_JENDELA = [15, 30, 45, 60] as const;
export const JENDELA_BAWAAN = 30;

/** Sesi (jendela_menit) atau kejadian kalender (kegiatan.jendela_menit). */
type WaktuAbsensi = {
  mulai: string;
  selesai: string | null;
  jendela_menit?: number;
  kegiatan?: { jendela_menit?: number };
};

export function menitJendela(w: WaktuAbsensi): number {
  return w.jendela_menit ?? w.kegiatan?.jendela_menit ?? JENDELA_BAWAAN;
}

/** Jam absensi terbuka & tertutup otomatis (ISO). */
export function jamAbsensi(waktu: WaktuAbsensi) {
  const ms = menitJendela(waktu) * 60_000;
  return {
    buka: new Date(new Date(waktu.mulai).getTime() - ms).toISOString(),
    tutup: new Date(new Date(waktu.selesai ?? waktu.mulai).getTime() + ms).toISOString(),
  };
}

/** Jendela scan sesi saat ini: null = boleh scan; selain itu belum waktunya / sudah lewat. */
export function jendelaScan(
  sesi: WaktuAbsensi,
  sekarang = Date.now(),
): "belum_waktunya" | "lewat_waktu" | null {
  const { buka, tutup } = jamAbsensi(sesi);
  if (sekarang < new Date(buka).getTime()) return "belum_waktunya";
  if (sekarang > new Date(tutup).getTime()) return "lewat_waktu";
  return null;
}
