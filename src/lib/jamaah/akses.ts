import "server-only";
import { cache } from "react";
import { getAdminSaatIni, type AdminSaatIni } from "@/lib/auth/admin";
import type { AturanKategori } from "@/lib/jamaah/kategori";
import { getFitur } from "@/lib/sistem/data";
import { createClient } from "@/lib/supabase/server";

export type KelompokRingkas = { id: string; nomor: number; nama: string };

export type AksesJamaah = {
  admin: AdminSaatIni;
  /** Kelompok aktif yang modul Jamaah-nya menyala (saklar fitur `jamaah`). */
  kelompokFitur: KelompokRingkas[];
  /** Kelompok (yang menyala) tempat admin boleh melihat / menambah / mengubah. */
  kelompokLihat: KelompokRingkas[];
  kelompokTambah: KelompokRingkas[];
  kelompokUbah: KelompokRingkas[];
  /** Izin lain (minimal di satu wilayah). Batas sebenarnya tetap RLS. */
  bolehHapus: boolean;
  bolehLihatKeringanan: boolean;
  bolehKelolaKeringanan: boolean;
  bolehLihatJandaDuda: boolean;
  bolehKelolaJandaDuda: boolean;
  /** Data sensitif (tabel terpisah): kontak, pribadi (orang tua & alamat), identitas. */
  bolehLihatKontak: boolean;
  bolehKelolaKontak: boolean;
  bolehLihatPribadi: boolean;
  bolehKelolaPribadi: boolean;
  bolehLihatIdentitas: boolean;
  bolehKelolaIdentitas: boolean;
  /** Semua perannya khusus generus. */
  generusSaja: boolean;
};

/** Wilayah sebuah izin: null = seluruh desa; selain itu daftar kelompok. */
function wilayah(admin: AdminSaatIni, izin: string): string[] | null | undefined {
  const daftar = admin.izinWilayah[izin];
  if (!daftar?.length) return undefined;
  if (daftar.includes(null)) return null;
  return daftar as string[];
}

function saring(kelompok: KelompokRingkas[], w: string[] | null | undefined) {
  if (w === undefined) return [];
  return w === null ? kelompok : kelompok.filter((k) => w.includes(k.id));
}

/**
 * Hak akses modul Jamaah untuk admin yang login (null = bukan admin).
 * Saklar fitur dibaca fail-open: tabel fitur tidak terbaca / baris `jamaah`
 * tidak ada → dianggap menyala di semua kelompok. Di-cache per request.
 */
export const getAksesJamaah = cache(async (): Promise<AksesJamaah | null> => {
  const admin = await getAdminSaatIni();
  if (!admin) return null;

  const supabase = await createClient();
  const [{ data: kelompok }, fitur] = await Promise.all([
    supabase
      .from("kelompok")
      .select("id, nomor, nama")
      .eq("aktif", true)
      .order("nomor")
      .returns<KelompokRingkas[]>(),
    getFitur(),
  ]);

  const jamaah = fitur.find((f) => f.kode === "jamaah");
  const semua = kelompok ?? [];
  const kelompokFitur = !jamaah
    ? semua
    : !jamaah.aktif
      ? []
      : jamaah.semua_kelompok
        ? semua
        : semua.filter((k) => jamaah.fitur_kelompok.some((f) => f.kelompok_id === k.id));

  const ada = (izin: string) => wilayah(admin, izin) !== undefined;

  return {
    admin,
    kelompokFitur,
    kelompokLihat: saring(kelompokFitur, wilayah(admin, "jamaah.lihat")),
    kelompokTambah: saring(kelompokFitur, wilayah(admin, "jamaah.tambah")),
    kelompokUbah: saring(kelompokFitur, wilayah(admin, "jamaah.ubah")),
    bolehHapus: ada("jamaah.hapus"),
    bolehLihatKeringanan: ada("keringanan.lihat"),
    bolehKelolaKeringanan: ada("keringanan.kelola"),
    bolehLihatJandaDuda: ada("janda_duda.lihat"),
    bolehKelolaJandaDuda: ada("janda_duda.kelola"),
    bolehLihatKontak: ada("kontak.lihat"),
    bolehKelolaKontak: ada("kontak.kelola"),
    bolehLihatPribadi: ada("pribadi.lihat"),
    bolehKelolaPribadi: ada("pribadi.kelola"),
    bolehLihatIdentitas: ada("identitas.lihat"),
    bolehKelolaIdentitas: ada("identitas.kelola"),
    generusSaja: admin.penugasan.every((p) => p.hanyaGenerus),
  };
});

/** Menu Jamaah terbuka: boleh melihat jamaah di minimal satu kelompok yang menyala. */
export async function menuJamaahTerbuka(): Promise<boolean> {
  const akses = await getAksesJamaah();
  return Boolean(akses && akses.kelompokLihat.length > 0);
}

/** Aturan kategori jamaah (untuk pratinjau di form & filter). */
export const getAturanKategori = cache(async (): Promise<AturanKategori[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kategori_jamaah")
    .select(
      "id, nama, urutan, usia_min, usia_max, status_sekolah_berlaku, status_pernikahan_berlaku, termasuk_generus",
    )
    .order("urutan")
    .returns<AturanKategori[]>();
  return data ?? [];
});
