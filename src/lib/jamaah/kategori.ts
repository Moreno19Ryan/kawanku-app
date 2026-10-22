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

// ---------------------------------------------------------------------------
// Analisis prioritas aturan (Pengaturan → Kategori)
// ---------------------------------------------------------------------------

const SEKOLAH = ["belum_sekolah", "paud_tk", "sd", "smp", "sma_smk", "kuliah", "bekerja", "lainnya"] as const;
const NIKAH = ["lajang", "menikah", "janda_duda"] as const;

/** Rentang usia wajar per status sekolah, supaya peringatan tidak berisi kasus mustahil. */
const USIA_WAJAR: Record<(typeof SEKOLAH)[number], [number, number]> = {
  belum_sekolah: [0, 7],
  paud_tk: [2, 7],
  sd: [6, 14],
  smp: [11, 17],
  sma_smk: [14, 21],
  kuliah: [17, 45],
  bekerja: [15, 90],
  lainnya: [5, 90],
};

export type Kombinasi = { sekolah: string; nikah: string; usia: number };

export type CatatanPrioritas = {
  /** Cocok dengan jamaah yang wajar, tapi selalu kalah oleh aturan di atasnya. */
  tidakTerpakai: boolean;
  /** Aturan di atasnya yang mengambil sebagian jamaah yang juga cocok dengan aturan ini. */
  kalahDari: { nama: string; contoh: Kombinasi }[];
  /** Kategori generus yang bisa berisi jamaah yang sudah menikah / janda-duda. */
  generusMenikah: Kombinasi | null;
};

/**
 * Simulasikan semua kombinasi jamaah yang wajar (status sekolah × status
 * pernikahan × usia) terhadap aturan berurutan, untuk memperingatkan
 * admin bila urutan/aturan membuat kategori tidak pernah terpakai atau
 * membuat jamaah yang sudah menikah terhitung generus.
 */
export function analisisPrioritas(aturan: AturanKategori[]): Map<string, CatatanPrioritas> {
  const urut = [...aturan].sort((a, b) => a.urutan - b.urutan);
  const hasil = new Map<string, CatatanPrioritas>(
    urut.map((k) => [k.id, { tidakTerpakai: false, kalahDari: [], generusMenikah: null }]),
  );
  const cocok = new Map<string, number>();
  const menang = new Map<string, number>();
  const cocokDengan = (k: AturanKategori, c: Kombinasi) => cariKategori([k], c.usia, c.nikah, c.sekolah) !== null;

  for (const sekolah of SEKOLAH) {
    const [dari, sampai] = USIA_WAJAR[sekolah];
    const bolehMenikah = !["belum_sekolah", "paud_tk", "sd", "smp", "sma_smk"].includes(sekolah);
    for (const nikah of NIKAH) {
      if (nikah !== "lajang" && !bolehMenikah) continue;
      for (let usia = dari; usia <= sampai; usia++) {
        if (nikah !== "lajang" && usia < 16) continue;
        const c = { sekolah, nikah, usia };
        const semua = urut.filter((k) => cocokDengan(k, c));
        if (!semua.length) continue;
        const [pemenang, ...kalah] = semua;
        menang.set(pemenang.id, (menang.get(pemenang.id) ?? 0) + 1);
        for (const k of semua) cocok.set(k.id, (cocok.get(k.id) ?? 0) + 1);
        for (const k of kalah) {
          const catatan = hasil.get(k.id)!;
          const ada = catatan.kalahDari.find((x) => x.nama === pemenang.nama);
          // Contoh yang paling mudah dikenali: usia mendekati 30 th.
          if (!ada) catatan.kalahDari.push({ nama: pemenang.nama, contoh: c });
          else if (Math.abs(usia - 30) < Math.abs(ada.contoh.usia - 30)) ada.contoh = c;
        }
        if (pemenang.termasuk_generus && nikah !== "lajang") {
          const catatan = hasil.get(pemenang.id)!;
          if (!catatan.generusMenikah || Math.abs(usia - 30) < Math.abs(catatan.generusMenikah.usia - 30)) {
            catatan.generusMenikah = c;
          }
        }
      }
    }
  }
  for (const k of urut) {
    const catatan = hasil.get(k.id)!;
    catatan.tidakTerpakai = (cocok.get(k.id) ?? 0) > 0 && !menang.get(k.id);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Urutan otomatis (sistem) & pemeriksaan aturan
// ---------------------------------------------------------------------------

/**
 * Urutan pemeriksaan yang diatur sistem, dari bentuk aturannya (admin tidak
 * mengurutkan sendiri):
 *   1. aturan usia saja (mis. Lansia), usia minimal tertinggi dulu;
 *   2. aturan bukan generus yang memuat menikah/janda-duda (Berkeluarga);
 *   3. aturan bukan generus lainnya (mis. Caberawit);
 *   4. aturan generus (selalu khusus lajang, dijaga database).
 * Di dalam kelompok yang sama: jenjang sekolah termuda dulu, lalu usia, nama.
 */
export function urutanSistem<T extends AturanKategori>(aturan: T[]): T[] {
  const tingkat = (k: AturanKategori) => {
    const sekolah = k.status_sekolah_berlaku?.length ?? 0;
    const nikah = k.status_pernikahan_berlaku ?? [];
    if (!sekolah && !nikah.length && k.usia_min !== null) return 0;
    if (k.termasuk_generus) return 3;
    return nikah.some((n) => n !== "lajang") ? 1 : 2;
  };
  const jenjang = (k: AturanKategori) =>
    Math.min(99, ...(k.status_sekolah_berlaku ?? []).map((s) => SEKOLAH.indexOf(s as (typeof SEKOLAH)[number])));
  return [...aturan].sort(
    (a, b) =>
      tingkat(a) - tingkat(b) ||
      (tingkat(a) === 0 ? (b.usia_min ?? 0) - (a.usia_min ?? 0) : 0) ||
      jenjang(a) - jenjang(b) ||
      (a.usia_min ?? -1) - (b.usia_min ?? -1) ||
      a.nama.localeCompare(b.nama, "id"),
  );
}

/**
 * Masalah yang membuat aturan ditolak disimpan (urutan sistem dipakai):
 * kategori yang tidak pernah terpakai, atau kategori generus yang bisa
 * memuat jamaah yang sudah menikah. Kosong = aman.
 */
export function masalahAturan(aturan: AturanKategori[]): string[] {
  const urut = urutanSistem(aturan).map((k, i) => ({ ...k, urutan: i + 1 }));
  const catatan = analisisPrioritas(urut);
  const hasil: string[] = [];
  for (const k of urut) {
    const c = catatan.get(k.id)!;
    if (c.tidakTerpakai) {
      hasil.push(
        `“${k.nama}” tidak akan pernah terpakai: semua jamaah yang cocok sudah masuk ${c.kalahDari
          .map((x) => `“${x.nama}”`)
          .join(", ")}.`,
      );
    }
    if (c.generusMenikah) hasil.push(`“${k.nama}” (generus) bisa memuat jamaah yang sudah menikah.`);
  }
  return hasil;
}

/** Kalimat singkat mengapa jamaah masuk kategori ini, mis. "status menikah". */
export function alasanKategori(
  k: AturanKategori,
  label: { sekolah: Record<string, string>; nikah: Record<string, string> },
): string {
  const bagian: string[] = [];
  if (k.usia_min !== null && k.usia_max !== null) bagian.push(`usia ${k.usia_min}–${k.usia_max} th`);
  else if (k.usia_min !== null) bagian.push(`usia ${k.usia_min} th ke atas`);
  else if (k.usia_max !== null) bagian.push(`usia sampai ${k.usia_max} th`);
  const nikah = k.status_pernikahan_berlaku ?? [];
  if (nikah.length && !(k.termasuk_generus && nikah.length === 1)) {
    bagian.push(`status ${nikah.map((n) => (label.nikah[n] ?? n).toLowerCase()).join("/")}`);
  }
  if (k.status_sekolah_berlaku?.length) {
    bagian.push(k.status_sekolah_berlaku.map((s) => label.sekolah[s] ?? s).join("/"));
  }
  if (k.termasuk_generus) bagian.push("belum menikah");
  return bagian.join(", ");
}

/** Rentang usia lazim per jenjang (di luar ini = perlu dipastikan). */
export const RENTANG_JENJANG: Record<string, [number, number]> = {
  belum_sekolah: [0, 7],
  paud_tk: [2, 7],
  sd: [5, 13],
  smp: [11, 16],
  sma_smk: [14, 19],
};

const JENJANG_SEKOLAH = ["belum_sekolah", "paud_tk", "sd", "smp", "sma_smk"];

/**
 * Kombinasi data yang tidak lazim (bukan pasti salah, tapi perlu
 * dipastikan), supaya kategori akurat. Dipakai di form jamaah (saat
 * mengisi) dan di "Perlu dicek".
 */
export function cekKewajaran(
  usia: number | null,
  statusPernikahan: string | null,
  statusSekolah: string | null,
  label: { sekolah: Record<string, string> },
): { jenjang: string | null; lain: string[] } {
  const namaSekolah = statusSekolah ? (label.sekolah[statusSekolah] ?? statusSekolah) : "";
  const r = statusSekolah ? RENTANG_JENJANG[statusSekolah] : undefined;
  const jenjang =
    r && usia !== null && (usia < r[0] || usia > r[1])
      ? `Usia ${usia} th tapi tercatat ${namaSekolah}. Sudah lulus/naik jenjang?`
      : null;
  const lain: string[] = [];
  const menikah = statusPernikahan === "menikah" || statusPernikahan === "janda_duda";
  if (menikah && usia !== null && usia < 16) lain.push(`Usia ${usia} th tapi tercatat sudah menikah.`);
  if (menikah && statusSekolah && JENJANG_SEKOLAH.includes(statusSekolah)) {
    lain.push(`Tercatat sudah menikah tapi masih ${namaSekolah}.`);
  }
  if ((statusSekolah === "kuliah" || statusSekolah === "bekerja") && usia !== null && usia < 15) {
    lain.push(`Usia ${usia} th tapi tercatat ${namaSekolah.toLowerCase()}.`);
  }
  return { jenjang, lain };
}
