/**
 * Perhitungan usia & kategori di sisi klien, HANYA untuk pratinjau di form.
 * Sumber kebenaran tetap database (private.usia, private.kategori_jamaah_id,
 * view jamaah_dengan_kategori); logika di sini harus sama dengan itu.
 */

export type AturanKategori = {
  id: string;
  nama: string;
  urutan: number;
  usia_min: number | null;
  usia_max: number | null;
  status_sekolah_berlaku: string[] | null;
  status_pernikahan_berlaku: string[] | null;
  termasuk_generus: boolean;
};

/** Sama dengan private.usia: dari tanggal lahir, kalau tidak dari tahun lahir. */
export function hitungUsia(
  tanggalLahir: string | null,
  tahunLahir: number | null,
  hariIni = new Date(),
): number | null {
  if (tanggalLahir) {
    const [t, b, h] = tanggalLahir.split("-").map(Number);
    if (!t || !b || !h) return null;
    let usia = hariIni.getFullYear() - t;
    const bulan = hariIni.getMonth() + 1;
    if (bulan < b || (bulan === b && hariIni.getDate() < h)) usia--;
    return usia;
  }
  if (tahunLahir) return hariIni.getFullYear() - tahunLahir;
  return null;
}

/** Sama dengan private.kategori_jamaah_id: aturan pertama (urutan) yang cocok. */
export function cariKategori(
  aturan: AturanKategori[],
  usia: number | null,
  statusPernikahan: string | null,
  statusSekolah: string | null,
): AturanKategori | null {
  const urut = [...aturan].sort((a, b) => a.urutan - b.urutan);
  return (
    urut.find(
      (k) =>
        (k.usia_min === null || (usia !== null && usia >= k.usia_min)) &&
        (k.usia_max === null || (usia !== null && usia <= k.usia_max)) &&
        (!k.status_sekolah_berlaku?.length ||
          (statusSekolah !== null && k.status_sekolah_berlaku.includes(statusSekolah))) &&
        (!k.status_pernikahan_berlaku?.length ||
          (statusPernikahan !== null && k.status_pernikahan_berlaku.includes(statusPernikahan))),
    ) ?? null
  );
}
