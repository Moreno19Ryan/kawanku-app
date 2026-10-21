import "server-only";
import { cache } from "react";
import { getAdminSaatIni, punyaIzin, punyaIzinDi, type AdminSaatIni } from "@/lib/auth/admin";
import type { KelompokRingkas } from "@/lib/jamaah/akses";
import { getFitur } from "@/lib/sistem/data";
import { createClient } from "@/lib/supabase/server";

/** Pilihan wilayah + sasaran saat membuat sesi. kelompokId null = seluruh desa. */
export type TargetSesi = { kelompokId: string | null; nama: string; umum: boolean };

export type AksesAbsensi = {
  admin: AdminSaatIni;
  /** Kelompok aktif yang modul Absensi-nya menyala (saklar fitur `absensi`). */
  kelompokFitur: KelompokRingkas[];
  /** Kelompok (yang menyala) tempat admin boleh melihat / mengelola absensi. */
  kelompokLihat: KelompokRingkas[];
  kelompokKelola: KelompokRingkas[];
  /** Boleh melihat sesi tingkat desa (wilayah absensi.lihat apa pun). */
  bolehLihat: boolean;
  /** Wilayah sesi yang boleh dibuat; umum=false → hanya sesi generus. */
  targetSesi: TargetSesi[];
  bolehLihatKeringanan: boolean;
  /** Kelompok (yang menyala) tempat admin boleh mengelola akun generus. */
  kelompokAkun: KelompokRingkas[];
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

/**
 * Hak akses modul Absensi untuk admin yang login (null = bukan admin).
 * Saklar fitur dibaca fail-open seperti modul Jamaah. Batas sebenarnya RLS
 * (private.boleh_lihat_sesi / boleh_kelola_sesi / boleh_jamaah).
 */
export const getAksesAbsensi = cache(async (): Promise<AksesAbsensi | null> => {
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

  const absensi = fitur.find((f) => f.kode === "absensi");
  const semua = kelompok ?? [];
  const kelompokFitur = !absensi
    ? semua
    : !absensi.aktif
      ? []
      : absensi.semua_kelompok
        ? semua
        : semua.filter((k) => absensi.fitur_kelompok.some((f) => f.kelompok_id === k.id));

  const kelola = wilayah(admin, "absensi.kelola");
  const kelompokKelola = saring(kelompokFitur, kelola);
  const targetSesi: TargetSesi[] = [];
  if (kelola === null && kelompokFitur.length > 0) {
    targetSesi.push({ kelompokId: null, nama: "Seluruh desa", umum: punyaIzin(admin, "absensi.kelola") });
  }
  for (const k of kelompokKelola) {
    targetSesi.push({ kelompokId: k.id, nama: k.nama, umum: punyaIzinDi(admin, "absensi.kelola", k.id) });
  }

  const kelompokLihat = saring(kelompokFitur, wilayah(admin, "absensi.lihat"));
  return {
    admin,
    kelompokFitur,
    kelompokLihat,
    kelompokKelola,
    bolehLihat: kelompokLihat.length > 0,
    targetSesi,
    bolehLihatKeringanan: Boolean(admin.izinWilayah["keringanan.lihat"]?.length),
    kelompokAkun: saring(kelompokFitur, wilayah(admin, "akun_generus.kelola")),
  };
});

/** Menu Absensi terbuka: boleh melihat absensi di minimal satu kelompok yang menyala. */
export async function menuAbsensiTerbuka(): Promise<boolean> {
  const akses = await getAksesAbsensi();
  return Boolean(akses?.bolehLihat);
}

export type Sesi = {
  id: string;
  nama: string;
  kelompok_id: string | null;
  hanya_generus: boolean;
  mulai: string;
  selesai: string | null;
  ditutup: boolean;
};

export const KOLOM_SESI = "id, nama, kelompok_id, hanya_generus, mulai, selesai, ditutup";

/** Boleh mengelola sesi ini (UX; batas sebenarnya RLS boleh_kelola_sesi). */
export function bolehKelolaSesi(akses: AksesAbsensi, sesi: Pick<Sesi, "kelompok_id" | "hanya_generus">) {
  const t = akses.targetSesi.find((x) => x.kelompokId === sesi.kelompok_id);
  return Boolean(t && (t.umum || sesi.hanya_generus));
}

/** Boleh mencatat kehadiran di sesi ini: punya absensi.kelola di kelompok mana pun yang ikut. */
export function bolehCatatSesi(akses: AksesAbsensi, sesi: Pick<Sesi, "kelompok_id">) {
  return sesi.kelompok_id === null
    ? akses.kelompokKelola.length > 0
    : akses.kelompokKelola.some((k) => k.id === sesi.kelompok_id);
}
