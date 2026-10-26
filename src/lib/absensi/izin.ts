import "server-only";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { LABEL_ALASAN_IZIN } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";

export type PengajuanIzin = {
  id: string;
  jamaah_id: string;
  kegiatan_id: string;
  kelompok_id: string | null;
  tanggal: string;
  jenis: "izin" | "sakit";
  alasan_izin: string | null;
  keterangan: string | null;
  status: "menunggu" | "disetujui" | "ditolak";
  tanggapan: string | null;
  created_at: string;
  jamaah: { nama_lengkap: string; kode: string; kelompok_id: string } | null;
  kegiatan: { nama: string } | null;
};

export const KOLOM_PENGAJUAN =
  "id, jamaah_id, kegiatan_id, kelompok_id, tanggal, jenis, alasan_izin, keterangan, status, tanggapan, created_at, jamaah:jamaah_id(nama_lengkap, kode, kelompok_id), kegiatan:kegiatan_id(nama)";

/** "Sakit" / "Izin · kuliah". */
export function labelPengajuan(p: { jenis: string; alasan_izin: string | null }): string {
  if (p.jenis === "sakit") return "Sakit";
  return `Izin · ${(LABEL_ALASAN_IZIN[p.alasan_izin ?? ""] ?? "lainnya").toLowerCase()}`;
}

/**
 * Pengajuan izin dari generus yang terlihat admin ini (RLS absensi.lihat),
 * di kelompok yang modul Absensi-nya menyala. `bolehTangani` = kelompok
 * jamaahnya termasuk wilayah absensi.kelola admin.
 */
export async function getPengajuanIzin(opsi: {
  menunggu?: boolean;
  kejadian?: { kegiatanId: string; kelompokId: string | null; tanggal: string };
}): Promise<(PengajuanIzin & { bolehTangani: boolean })[]> {
  const akses = await getAksesAbsensi();
  if (!akses || akses.kelompokLihat.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("pengajuan_izin")
    .select(KOLOM_PENGAJUAN)
    .order("tanggal")
    .order("created_at")
    .limit(200);
  if (opsi.menunggu) q = q.eq("status", "menunggu");
  if (opsi.kejadian) {
    q = q.eq("kegiatan_id", opsi.kejadian.kegiatanId).eq("tanggal", opsi.kejadian.tanggal);
    q = opsi.kejadian.kelompokId ? q.eq("kelompok_id", opsi.kejadian.kelompokId) : q.is("kelompok_id", null);
  }
  const { data } = await q.returns<PengajuanIzin[]>();
  const lihat = new Set(akses.kelompokLihat.map((k) => k.id));
  const kelola = new Set(akses.kelompokKelola.map((k) => k.id));
  const catat = new Set(akses.kelompokCatat.map((k) => k.id));
  // Kegiatan kelompok: hanya pengurus kelompok itu (RLS boleh_absensi_di).
  return (data ?? [])
    .filter((p) => p.jamaah && lihat.has(p.jamaah.kelompok_id))
    .map((p) => ({
      ...p,
      bolehTangani: kelola.has(p.jamaah!.kelompok_id) && (p.kelompok_id === null || catat.has(p.kelompok_id)),
    }));
}
