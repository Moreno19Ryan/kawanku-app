import "server-only";
import { cache } from "react";
import { getAdminSaatIni, punyaIzin, type AdminSaatIni } from "@/lib/auth/admin";
import type { KelompokRingkas } from "@/lib/jamaah/akses";
import { getFitur } from "@/lib/sistem/data";
import { createClient } from "@/lib/supabase/server";

/** Pilihan wilayah saat membuat kegiatan. */
export type TargetKegiatan = {
  /** "desa" | id kelompok */
  nilai: string;
  nama: string;
  /** false = hanya kegiatan khusus generus (peran admin generus). */
  umum: boolean;
};

export type AksesKegiatan = {
  admin: AdminSaatIni;
  kelompokFitur: KelompokRingkas[];
  kelompokLihat: KelompokRingkas[];
  kelompokKelola: KelompokRingkas[];
  lihatSeluruhDesa: boolean;
  /** Penugasan tingkat desa dengan kegiatan.kelola: hanya kegiatan desa. */
  kelolaDesa: boolean;
  targetKegiatan: TargetKegiatan[];
};

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

/** Hak akses modul Kegiatan (saklar fitur `kegiatan` ∩ izin). Batas sebenarnya RLS. */
export const getAksesKegiatan = cache(async (): Promise<AksesKegiatan | null> => {
  const admin = await getAdminSaatIni();
  if (!admin) return null;
  const supabase = await createClient();
  const [{ data: kelompok }, fitur] = await Promise.all([
    supabase.from("kelompok").select("id, nomor, nama").eq("aktif", true).order("nomor").returns<KelompokRingkas[]>(),
    getFitur(),
  ]);
  const f = fitur.find((x) => x.kode === "kegiatan");
  const semua = kelompok ?? [];
  const kelompokFitur = !f
    ? semua
    : !f.aktif
      ? []
      : f.semua_kelompok
        ? semua
        : semua.filter((k) => f.fitur_kelompok.some((x) => x.kelompok_id === k.id));

  // Kelola TEPAT di wilayah penugasan (RLS boleh_kelola_wilayah): penugasan
  // desa → kegiatan desa saja; kegiatan kelompok hanya oleh kelompoknya.
  const kelola = admin.izinWilayah["kegiatan.kelola"] ?? [];
  const kelompokKelola = kelompokFitur.filter((k) => kelola.includes(k.id));
  const kelolaDesa = kelola.includes(null) && kelompokFitur.length > 0;
  const targetKegiatan: TargetKegiatan[] = [
    ...(kelolaDesa
      ? [{ nilai: "desa", nama: "Tingkat desa (sambung desa)", umum: punyaIzin(admin, "kegiatan.kelola") }]
      : []),
    ...kelompokKelola.map((k) => ({ nilai: k.id, nama: k.nama, umum: Boolean(admin.izinKelompok["kegiatan.kelola"]?.includes(k.id)) })),
  ];
  const kelompokLihat = saring(kelompokFitur, wilayah(admin, "kegiatan.lihat"));
  return {
    admin,
    kelompokFitur,
    kelompokLihat,
    kelompokKelola,
    lihatSeluruhDesa: wilayah(admin, "kegiatan.lihat") === null && kelompokLihat.length > 0,
    kelolaDesa,
    targetKegiatan,
  };
});

export async function menuKegiatanTerbuka(): Promise<boolean> {
  const akses = await getAksesKegiatan();
  return Boolean(akses && akses.kelompokLihat.length > 0);
}

/** Boleh mengelola pertemuan ini (UX; batas sebenarnya RLS boleh_kelola_pertemuan). */
export function bolehKelolaPertemuan(
  akses: AksesKegiatan,
  kelompokId: string | null,
  hanyaGenerus: boolean,
): boolean {
  const izin = akses.admin.izinWilayah["kegiatan.kelola"] ?? [];
  if (!izin.includes(kelompokId)) return false;
  if (hanyaGenerus) return true;
  return kelompokId === null
    ? punyaIzin(akses.admin, "kegiatan.kelola")
    : Boolean(akses.admin.izinKelompok["kegiatan.kelola"]?.includes(kelompokId));
}
