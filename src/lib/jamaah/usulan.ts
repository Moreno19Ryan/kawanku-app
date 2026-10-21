import "server-only";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { createClient } from "@/lib/supabase/server";

export type UsulanKoreksi = {
  id: string;
  bagian: string;
  isi: string;
  created_at: string;
  jamaah: { id: string; nama_lengkap: string; kode: string; kelompok_id: string } | null;
};

/**
 * Laporan data salah dari generus yang masih menunggu, di kelompok yang
 * modul Jamaah-nya menyala dan boleh diubah admin ini (RLS tetap membatasi).
 */
export async function getUsulanMenunggu(jamaahId?: string): Promise<UsulanKoreksi[]> {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokUbah.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("usulan_koreksi")
    .select("id, bagian, isi, created_at, jamaah:jamaah_id!inner(id, nama_lengkap, kode, kelompok_id)")
    .eq("status", "menunggu")
    .in("jamaah.kelompok_id", akses.kelompokUbah.map((k) => k.id))
    .order("created_at");
  if (jamaahId) q = q.eq("jamaah_id", jamaahId);
  const { data } = await q.returns<UsulanKoreksi[]>();
  return data ?? [];
}
