import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Sapaan = {
  jamaah_id: string;
  hasil: "tersambung" | "belum_tersambung" | "berhalangan";
  catatan: string | null;
  created_at: string;
  /** Nama admin pencatat (bila terbaca). */
  oleh: string | null;
};

export const LABEL_HASIL_SAPAAN: Record<Sapaan["hasil"], string> = {
  tersambung: "Sudah disapa",
  berhalangan: "Sedang berhalangan",
  belum_tersambung: "Belum tersambung",
};

/** Sapaan terakhir per jamaah (RLS: yang boleh melihat absensinya). */
export async function getSapaanTerakhir(jamaahIds: string[]): Promise<Map<string, Sapaan>> {
  const hasil = new Map<string, Sapaan>();
  if (!jamaahIds.length) return hasil;
  const supabase = await createClient();
  const [{ data }, { data: admin }] = await Promise.all([
    supabase
      .from("sapaan_jamaah")
      .select("jamaah_id, hasil, catatan, created_at, oleh")
      .in("jamaah_id", jamaahIds.slice(0, 300))
      .order("created_at", { ascending: false })
      .returns<(Omit<Sapaan, "oleh"> & { oleh: string | null })[]>(),
    supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
  ]);
  const nama = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));
  for (const s of data ?? []) {
    if (!hasil.has(s.jamaah_id)) hasil.set(s.jamaah_id, { ...s, oleh: s.oleh ? (nama.get(s.oleh) ?? null) : null });
  }
  return hasil;
}
