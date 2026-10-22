/**
 * Pengumuman yang tampaknya mengabarkan perubahan jadwal (pindah, libur,
 * batal, ganti jam). Dipakai form pengumuman generus untuk mengingatkan
 * pengurus mengubah pertemuannya juga, supaya pengumuman & jadwal di HP
 * generus tidak bertentangan. Fungsi murni.
 */
const POLA_PERUBAHAN_JADWAL =
  /\b(pindah|dipindah\w*|libur|diliburkan|batal|dibatalkan|ditiadakan|diundur|dimajukan|ditunda|ganti\s+(jam|hari|tempat|waktu)|tidak\s+ada\s+(pengajian|kegiatan)|ga(k)?\s+ada\s+(pengajian|kegiatan))\b/i;

export function sepertiPerubahanJadwal(pesan: string): boolean {
  return POLA_PERUBAHAN_JADWAL.test(pesan);
}
