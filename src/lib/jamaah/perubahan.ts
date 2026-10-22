import "server-only";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { createClient } from "@/lib/supabase/server";

export type PerubahanGenerus = {
  id: string;
  bagian: string;
  nilai_lama: string | null;
  nilai_baru: string | null;
  created_at: string;
};

export type PerubahanPerJamaah = {
  jamaah: { id: string; nama_lengkap: string; kode: string };
  butir: PerubahanGenerus[];
};

/**
 * Perubahan data diri oleh generus yang belum dicek admin, dikelompokkan per
 * jamaah (terbaru dulu). Hanya kelompok yang boleh diubah admin ini & modul
 * Jamaah-nya menyala (RLS tetap membatasi).
 */
export async function getPerubahanGenerus(jamaahId?: string): Promise<PerubahanPerJamaah[]> {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokUbah.length === 0) return [];
  const supabase = await createClient();
  let q = supabase
    .from("perubahan_data_generus")
    .select("id, bagian, nilai_lama, nilai_baru, created_at, jamaah:jamaah_id!inner(id, nama_lengkap, kode, kelompok_id)")
    .is("diperiksa_at", null)
    .in("jamaah.kelompok_id", akses.kelompokUbah.map((k) => k.id))
    .order("created_at", { ascending: false })
    .limit(300);
  if (jamaahId) q = q.eq("jamaah_id", jamaahId);
  const { data } = await q.returns<(PerubahanGenerus & { jamaah: PerubahanPerJamaah["jamaah"] })[]>();

  const per = new Map<string, PerubahanPerJamaah>();
  for (const { jamaah, ...butir } of data ?? []) {
    const isi = per.get(jamaah.id) ?? { jamaah, butir: [] };
    isi.butir.push(butir);
    per.set(jamaah.id, isi);
  }
  return [...per.values()];
}
