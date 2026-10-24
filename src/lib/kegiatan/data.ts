import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hitungKalender, type Jadwal, type Kegiatan, type Kejadian, type PertemuanTersimpan } from "./jadwal";

export const KOLOM_KEGIATAN =
  "id, nama, jenis, kelompok_id, per_kelompok, hanya_generus, lokasi, keterangan, durasi_menit, aktif, berlaku_mulai, berlaku_sampai, absensi_otomatis, buka_sebelum_menit, tutup_setelah_menit";
export const KOLOM_PERTEMUAN =
  "id, kegiatan_id, kelompok_id, tanggal, mulai, status, alasan_batal, pemateri_jamaah_id, pemateri_nama, materi, catatan, sesi_id";

/**
 * Kalender kegiatan yang terlihat oleh pengguna (RLS) untuk rentang tanggal.
 * `kelompok` = kelompok yang ditampilkan untuk kegiatan serentak.
 */
export async function getKalender(dari: string, sampai: string, kelompok: string[]): Promise<Kejadian[]> {
  const supabase = await createClient();
  const [{ data: kegiatan }, { data: jadwal }, { data: pertemuan }] = await Promise.all([
    supabase.from("kegiatan").select(KOLOM_KEGIATAN).returns<Kegiatan[]>(),
    supabase.from("kegiatan_jadwal").select("id, kegiatan_id, hari, jam, kecuali_pekan_ke").returns<Jadwal[]>(),
    supabase
      .from("pertemuan")
      .select(KOLOM_PERTEMUAN)
      .gte("tanggal", dari)
      .lte("tanggal", sampai)
      .returns<PertemuanTersimpan[]>(),
  ]);
  const terlihat = new Set(kelompok);
  return hitungKalender({
    kegiatan: (kegiatan ?? []).filter((k) => k.kelompok_id === null || terlihat.has(k.kelompok_id)),
    jadwal: jadwal ?? [],
    pertemuan: (pertemuan ?? []).filter((p) => p.kelompok_id === null || terlihat.has(p.kelompok_id)),
    dari,
    sampai,
    kelompok,
  });
}
