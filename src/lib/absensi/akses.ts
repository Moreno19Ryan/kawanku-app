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
  /** absensi.lihat untuk seluruh desa (rekap lintas kelompok). */
  lihatSeluruhDesa: boolean;
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
    lihatSeluruhDesa: wilayah(admin, "absensi.lihat") === null && kelompokLihat.length > 0,
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
  /** Pertemuan Kegiatan pemilik sesi (setiap sesi lahir dari pertemuan). */
  pertemuan_id: string;
  /** Salinan pengaturan kegiatan: buka/tutup otomatis N menit sebelum/sesudah. */
  buka_otomatis: boolean;
  buka_sebelum_menit: number;
  tutup_setelah_menit: number;
  /** Dibuka admin (Buka sekarang / mode manual): scan diterima tanpa melihat jam. */
  dibuka_manual: boolean;
};

export const KOLOM_SESI =
  "id, nama, kelompok_id, hanya_generus, mulai, selesai, ditutup, pertemuan_id, buka_otomatis, buka_sebelum_menit, tutup_setelah_menit, dibuka_manual";

/** Pilihan menit buka sebelum / tutup sesudah kegiatan (sama dengan check di DB). */
export const PILIHAN_MENIT = [15, 30, 45, 60] as const;

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

/** Sesi absensi boleh dibuka paling cepat 2 jam sebelum mulai (sama dengan trigger cek_waktu_sesi). */
export const BUKA_SEBELUM_MS = 2 * 3600_000;

/** Waktu paling cepat absensi bisa dibuka (ISO), atau null bila sudah bisa. */
export function belumBisaDibuka(mulai: string, sekarang = Date.now()): string | null {
  const awal = new Date(mulai).getTime() - BUKA_SEBELUM_MS;
  return sekarang < awal ? new Date(awal).toISOString() : null;
}

/** Admin ini boleh membuka absensi pertemuan di wilayah ini (null = tingkat desa). */
export function bolehBukaAbsensi(akses: AksesAbsensi | null, kelompokId: string | null): boolean {
  if (!akses) return false;
  return kelompokId === null
    ? akses.kelompokKelola.length > 0 && akses.targetSesi.some((t) => t.kelompokId === null)
    : akses.kelompokKelola.some((x) => x.id === kelompokId);
}

type SesiWaktu = Pick<
  Sesi,
  "mulai" | "selesai" | "ditutup" | "buka_otomatis" | "buka_sebelum_menit" | "tutup_setelah_menit" | "dibuka_manual"
>;

/** Jam buka & tutup otomatis (ISO) dari pengaturan sesi. */
export function jamOtomatis(sesi: Pick<Sesi, "mulai" | "selesai" | "buka_sebelum_menit" | "tutup_setelah_menit">) {
  const buka = new Date(new Date(sesi.mulai).getTime() - sesi.buka_sebelum_menit * 60_000).toISOString();
  const tutup = new Date(new Date(sesi.selesai ?? sesi.mulai).getTime() + sesi.tutup_setelah_menit * 60_000).toISOString();
  return { buka, tutup };
}

/**
 * Status scan sesi saat ini (sama dengan private.waktu_scan): "dibuka" =
 * scan diterima; "ditutup" = ditutup admin / mode manual belum dibuka;
 * "belum_waktunya" / "lewat_waktu" = mode otomatis di luar jendela.
 */
export function statusScan(
  sesi: SesiWaktu,
  sekarang = Date.now(),
): "dibuka" | "ditutup" | "belum_waktunya" | "lewat_waktu" {
  if (sesi.ditutup) return "ditutup";
  if (sesi.dibuka_manual) return "dibuka";
  if (!sesi.buka_otomatis) return "ditutup";
  const { buka, tutup } = jamOtomatis(sesi);
  if (sekarang < new Date(buka).getTime()) return "belum_waktunya";
  if (sekarang > new Date(tutup).getTime()) return "lewat_waktu";
  return "dibuka";
}

/** Waktu (ISO) sudah lewat. */
export function sudahLewat(iso: string, sekarang = Date.now()): boolean {
  return new Date(iso).getTime() < sekarang;
}
