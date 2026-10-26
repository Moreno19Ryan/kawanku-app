import "server-only";
import { bolehBukaAbsensi, jendelaScan, type AksesAbsensi } from "@/lib/absensi/akses";
import type { Kejadian } from "@/lib/kegiatan/jadwal";
import { createClient } from "@/lib/supabase/server";

/**
 * Absensi serba otomatis: pertemuan terjadwal yang sedang di jendela absensi
 * (30 menit sebelum mulai s.d. 30 menit setelah selesai) dan belum punya
 * absensi langsung dibuatkan lewat RPC buka_absensi_pertemuan (idempoten;
 * batas tetap RLS). Dipanggil saat admin membuka Beranda, Absensi, atau
 * halaman pertemuan, jadi admin tidak perlu menekan tombol apa pun.
 * Mengembalikan kejadian yang sama dengan sesiId terisi.
 */
export async function siapkanAbsensiOtomatis(
  kejadian: Kejadian[],
  akses: AksesAbsensi | null,
  sekarang = Date.now(),
): Promise<Kejadian[]> {
  const perlu = kejadian.filter(
    (k) =>
      k.status === "terjadwal" &&
      !k.sesiId &&
      bolehBukaAbsensi(akses, k.kelompokId) &&
      jendelaScan(k, sekarang) === null,
  );
  if (perlu.length === 0) return kejadian;

  const supabase = await createClient();
  const sesi = new Map<string, string>();
  await Promise.all(
    perlu.map(async (k) => {
      const { data } = await supabase.rpc("buka_absensi_pertemuan", {
        p_kegiatan_id: k.kegiatan.id,
        p_kelompok_id: k.kelompokId,
        p_tanggal: k.tanggal,
        p_mulai: k.mulai,
      });
      if (typeof data === "string") sesi.set(k.kunci, data);
    }),
  );
  return kejadian.map((k) => (sesi.has(k.kunci) ? { ...k, sesiId: sesi.get(k.kunci)! } : k));
}
