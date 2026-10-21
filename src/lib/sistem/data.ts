import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StatusSistem = {
  perawatan: boolean;
  pesan: string | null;
  perkiraanSelesai: string | null;
  /** Dipaksa lewat env MODE_PERAWATAN=1 (darurat, mis. database bermasalah). */
  darurat: boolean;
};

export type Pengumuman = {
  id: string;
  pesan: string;
  nada: "info" | "peringatan";
  aktif: boolean;
  mulai: string;
  berakhir: string | null;
};

export type Fitur = {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  semua_kelompok: boolean;
  fitur_kelompok: { kelompok_id: string }[];
};

/**
 * Status mode perawatan. Gagal membaca (mis. migrasi panel belum diterapkan)
 * dianggap TIDAK perawatan supaya aplikasi tetap jalan; env MODE_PERAWATAN=1
 * selalu menang. Di-cache per request; harus di dalam <Suspense>.
 */
export const getStatusSistem = cache(async (): Promise<StatusSistem> => {
  const darurat = process.env.MODE_PERAWATAN === "1";
  const supabase = await createClient();
  const { data } = await supabase
    .from("pengaturan_sistem")
    .select("mode_perawatan, pesan_perawatan, perkiraan_selesai")
    .maybeSingle();

  return {
    perawatan: darurat || Boolean(data?.mode_perawatan),
    pesan: data?.pesan_perawatan ?? null,
    perkiraanSelesai: data?.perkiraan_selesai ?? null,
    darurat,
  };
});

/** Pengumuman yang sedang tayang (aktif, sudah mulai, belum berakhir). */
export const getPengumumanTayang = cache(async (): Promise<Pengumuman[]> => {
  const supabase = await createClient();
  const sekarang = new Date().toISOString();
  const { data } = await supabase
    .from("pengumuman")
    .select("id, pesan, nada, aktif, mulai, berakhir")
    .eq("aktif", true)
    .lte("mulai", sekarang)
    .or(`berakhir.is.null,berakhir.gt."${sekarang}"`)
    .order("mulai", { ascending: false })
    .limit(3)
    .returns<Pengumuman[]>();
  return data ?? [];
});

export const getFitur = cache(async (): Promise<Fitur[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fitur")
    .select("id, kode, nama, deskripsi, aktif, semua_kelompok, fitur_kelompok(kelompok_id)")
    .order("nama")
    .returns<Fitur[]>();
  return data ?? [];
});

/**
 * Apakah fitur menyala untuk admin dengan wilayah ini.
 * kelompokIds = null → admin tingkat desa: menyala bila aktif di kelompok mana pun.
 */
export function fiturMenyala(fitur: Fitur, kelompokIds: string[] | null): boolean {
  if (!fitur.aktif) return false;
  if (fitur.semua_kelompok) return true;
  const dipilih = fitur.fitur_kelompok.map((f) => f.kelompok_id);
  if (kelompokIds === null) return dipilih.length > 0;
  return kelompokIds.some((id) => dipilih.includes(id));
}
