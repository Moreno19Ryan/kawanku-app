import "server-only";
import { cache } from "react";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { createClient } from "@/lib/supabase/server";

/**
 * "Perlu dicek": daftar pemeriksaan kelengkapan data jamaah aktif (mis.
 * hasil impor) untuk dirapikan admin. Dihitung di server dari data yang
 * boleh dilihat admin (RLS) di kelompok yang modul Jamaah-nya menyala.
 */

export type KodePeriksa =
  | "data_pokok"
  | "tanpa_kategori"
  | "usia_jenjang"
  | "mt_ms"
  | "paket"
  | "alamat"
  | "kontak";

export type Pemeriksaan = {
  kode: KodePeriksa;
  judul: string;
  keterangan: string;
  /** Cara membetulkan (ditampilkan di detail jamaah). */
  saran: string;
};

export const PEMERIKSAAN: Pemeriksaan[] = [
  {
    kode: "data_pokok",
    judul: "Data pokok belum lengkap",
    keterangan: "Tanggal/tahun lahir, status pernikahan, atau status sekolah belum diisi.",
    saran: "Lengkapi tanggal/tahun lahir, status pernikahan, dan status sekolah di Ubah data.",
  },
  {
    kode: "tanpa_kategori",
    judul: "Tanpa kategori",
    keterangan: "Data belum cocok dengan aturan kategori mana pun.",
    saran: "Periksa status sekolah, status pernikahan, dan usia di Ubah data.",
  },
  {
    kode: "usia_jenjang",
    judul: "Usia tidak sesuai jenjang sekolah",
    keterangan:
      "Mis. usia 19+ masih tercatat SMA/SMK, atau usia 17 tercatat SMP. Bisa benar, tapi perlu dipastikan.",
    saran: "Pastikan status sekolah masih benar (sudah lulus? kuliah/bekerja?).",
  },
  {
    kode: "mt_ms",
    judul: "Muballigh/ot tanpa MT/MS",
    keterangan: "Berstatus muballigh/muballighot, tapi penugasan Tugasan (MT) / Setempat (MS) belum dipilih.",
    saran: "Pilih penugasan MT atau MS di Ubah data.",
  },
  {
    kode: "paket",
    judul: "Caberawit tanpa paket",
    keterangan: "Kategori Caberawit, tapi paket (A–F) belum diisi.",
    saran: "Pilih paket caberawit di Ubah data.",
  },
  {
    kode: "alamat",
    judul: "Alamat belum lengkap",
    keterangan: "Belum ada alamat, atau kecamatan/desa alamat saat ini belum dipilih.",
    saran: "Lengkapi alamat (sampai desa/kelurahan) di kartu Orang tua & alamat.",
  },
  {
    kode: "kontak",
    judul: "Belum ada no. HP",
    keterangan: "Belum ada no. HP jamaah maupun no. HP orang tua/wali.",
    saran: "Isi no. HP atau no. HP orang tua/wali di kartu Kontak.",
  },
];

export type BarisPeriksa = {
  id: string;
  kode: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: "L" | "P";
  usia: number | null;
  kelompok_id: string;
  kategori_jamaah_id: string | null;
  kategori_jamaah_kode: string | null;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
  aktif: boolean;
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  status_pernikahan: string | null;
  status_sekolah: string | null;
  muballigh: boolean;
  jenis_muballigh: string | null;
  paket_caberawit: string | null;
};

/** Rentang usia wajar per jenjang (di luar ini = perlu dipastikan). */
const RENTANG_JENJANG: Record<string, [number, number]> = {
  sd: [5, 13],
  smp: [11, 16],
  sma_smk: [14, 19],
};

type Pribadi = {
  jamaah_id: string;
  domisili_sama_ktp: boolean;
  ktp_kode_wilayah: string | null;
  dom_kode_wilayah: string | null;
};
type Kontak = { jamaah_id: string; no_hp: string | null; no_hp_wali: string | null };

export type HasilPeriksa = {
  /** Pemeriksaan yang berlaku untuk admin ini (sesuai izin mengubahnya). */
  daftar: Pemeriksaan[];
  baris: Map<string, BarisPeriksa>;
  /** kode pemeriksaan → id jamaah yang perlu dicek. */
  hasil: Record<KodePeriksa, string[]>;
  /** id jamaah → kode pemeriksaan yang gagal. */
  perJamaah: Map<string, KodePeriksa[]>;
};

/** Di-cache per request. Null bila admin tidak bisa melihat jamaah. */
export const getPerluDicek = cache(async (): Promise<HasilPeriksa | null> => {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokLihat.length === 0) return null;

  // Hanya tampilkan pemeriksaan yang bisa dibetulkan admin ini.
  const bolehUbah = akses.kelompokUbah.length > 0;
  const daftar = PEMERIKSAAN.filter((p) =>
    p.kode === "alamat"
      ? akses.bolehKelolaPribadi
      : p.kode === "kontak"
        ? akses.bolehKelolaKontak
        : bolehUbah,
  );
  const aktifKode = new Set(daftar.map((p) => p.kode));

  const supabase = await createClient();
  const [{ data: jamaah }, { data: pribadi }, { data: kontak }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select(
        "id, kode, nama_lengkap, nama_panggilan, jenis_kelamin, usia, kelompok_id, kategori_jamaah_id, kategori_jamaah_kode, kategori_jamaah_nama, termasuk_generus, aktif, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah, muballigh, jenis_muballigh, paket_caberawit",
      )
      .eq("aktif", true)
      .in(
        "kelompok_id",
        akses.kelompokLihat.map((k) => k.id),
      )
      .order("nama_lengkap")
      .returns<BarisPeriksa[]>(),
    aktifKode.has("alamat")
      ? supabase
          .from("jamaah_pribadi")
          .select("jamaah_id, domisili_sama_ktp, ktp_kode_wilayah, dom_kode_wilayah")
          .returns<Pribadi[]>()
      : Promise.resolve({ data: [] as Pribadi[] }),
    aktifKode.has("kontak")
      ? supabase.from("jamaah_kontak").select("jamaah_id, no_hp, no_hp_wali").returns<Kontak[]>()
      : Promise.resolve({ data: [] as Kontak[] }),
  ]);

  const petaPribadi = new Map((pribadi ?? []).map((p) => [p.jamaah_id, p]));
  const petaKontak = new Map((kontak ?? []).map((k) => [k.jamaah_id, k]));

  const uji: Record<KodePeriksa, (j: BarisPeriksa) => boolean> = {
    data_pokok: (j) => (!j.tanggal_lahir && !j.tahun_lahir) || !j.status_pernikahan || !j.status_sekolah,
    tanpa_kategori: (j) => !j.kategori_jamaah_id,
    usia_jenjang: (j) => {
      const r = j.status_sekolah ? RENTANG_JENJANG[j.status_sekolah] : undefined;
      return Boolean(r && j.usia !== null && (j.usia < r[0] || j.usia > r[1]));
    },
    mt_ms: (j) => j.muballigh && !j.jenis_muballigh,
    paket: (j) => j.kategori_jamaah_kode === "caberawit" && !j.paket_caberawit,
    alamat: (j) => {
      const p = petaPribadi.get(j.id);
      if (!p) return true;
      return !(p.domisili_sama_ktp ? p.ktp_kode_wilayah : p.dom_kode_wilayah);
    },
    kontak: (j) => {
      const k = petaKontak.get(j.id);
      return !k || (!k.no_hp && !k.no_hp_wali);
    },
  };

  const hasil = Object.fromEntries(PEMERIKSAAN.map((p) => [p.kode, [] as string[]])) as Record<
    KodePeriksa,
    string[]
  >;
  const perJamaah = new Map<string, KodePeriksa[]>();
  const baris = new Map<string, BarisPeriksa>();
  for (const j of jamaah ?? []) {
    baris.set(j.id, j);
    for (const p of daftar) {
      if (!uji[p.kode](j)) continue;
      hasil[p.kode].push(j.id);
      perJamaah.set(j.id, [...(perJamaah.get(j.id) ?? []), p.kode]);
    }
  }
  return { daftar, baris, hasil, perJamaah };
});

export function cariPemeriksaan(kode: string): Pemeriksaan | undefined {
  return PEMERIKSAAN.find((p) => p.kode === kode);
}
