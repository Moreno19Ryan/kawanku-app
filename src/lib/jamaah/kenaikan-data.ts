import "server-only";
import { tahunAjaran } from "@/lib/jamaah/kenaikan";
import { createClient } from "@/lib/supabase/server";

export type CalonKenaikan = {
  id: string;
  kode: string;
  nama_lengkap: string;
  status_sekolah: string;
  kelas: number | null;
  usia: number | null;
  termasuk_generus: boolean;
};

/**
 * Jamaah aktif bersekolah (SD/SMP/SMA) di sebuah kelompok yang kelasnya belum
 * untuk tahun ajaran berjalan (atau belum diisi). Dibaca dengan sesi admin
 * (RLS: admin generus hanya melihat generus).
 */
export async function getCalonKenaikan(kelompokId: string): Promise<CalonKenaikan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jamaah_dengan_kategori")
    .select("id, kode, nama_lengkap, status_sekolah, kelas, usia, termasuk_generus")
    .eq("kelompok_id", kelompokId)
    .eq("aktif", true)
    .in("status_sekolah", ["sd", "smp", "sma_smk"])
    .or(`kelas_tahun.is.null,kelas_tahun.lt.${tahunAjaran()}`)
    .order("kelas", { ascending: false, nullsFirst: false })
    .order("nama_lengkap")
    .limit(1000)
    .returns<CalonKenaikan[]>();
  return data ?? [];
}

/** Catatan kenaikan tahun ajaran berjalan per kelompok (siapa & kapan). */
export async function getCatatanKenaikan(kelompokIds: string[]) {
  if (!kelompokIds.length) return new Map<string, { jumlah: number; oleh: string; pada: string }>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("kenaikan_kelas")
    .select("kelompok_id, jumlah, updated_at, updated_by, created_by")
    .eq("tahun", tahunAjaran())
    .in("kelompok_id", kelompokIds)
    .returns<{ kelompok_id: string; jumlah: number; updated_at: string; updated_by: string | null; created_by: string | null }[]>();
  const ids = [...new Set((data ?? []).map((c) => c.updated_by ?? c.created_by).filter((x) => x !== null))];
  const { data: admin } = ids.length
    ? await supabase.from("admin").select("user_id, nama").in("user_id", ids).returns<{ user_id: string; nama: string }[]>()
    : { data: [] };
  const nama = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));
  return new Map(
    (data ?? []).map((c) => [
      c.kelompok_id,
      { jumlah: c.jumlah, oleh: nama.get(c.updated_by ?? c.created_by ?? "") ?? "admin", pada: c.updated_at },
    ]),
  );
}

/** Jumlah jamaah berkelas yang belum dinaikkan tahun ajaran ini (untuk pengingat). */
export async function hitungBelumNaik(kelompokIds: string[]): Promise<number> {
  if (!kelompokIds.length) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("jamaah")
    .select("id", { count: "exact", head: true })
    .in("kelompok_id", kelompokIds)
    .eq("aktif", true)
    .not("kelas", "is", null)
    .lt("kelas_tahun", tahunAjaran());
  return count ?? 0;
}
