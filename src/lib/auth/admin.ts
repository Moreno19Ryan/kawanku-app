import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PenugasanAdmin = {
  peranKode: string;
  peranNama: string;
  /** null = seluruh desa. */
  kelompok: { nomor: number; nama: string } | null;
};

export type AdminSaatIni = {
  userId: string;
  nama: string;
  penugasan: PenugasanAdmin[];
};

type BarisAdmin = {
  nama: string;
  aktif: boolean;
  penugasan_peran: {
    peran: { kode: string; nama: string } | null;
    kelompok: { nomor: number; nama: string } | null;
  }[];
};

/**
 * Data Access Layer: admin yang sedang login, atau null bila belum login,
 * bukan admin, nonaktif, atau belum punya penugasan peran (sama dengan
 * private.adalah_admin() di database). Di-cache per request.
 *
 * Membaca cookie sesi, jadi pemanggilnya harus berada di dalam <Suspense>.
 * Ini hanya untuk UX; batas akses sebenarnya tetap RLS di database.
 */
export const getAdminSaatIni = cache(async (): Promise<AdminSaatIni | null> => {
  const supabase = await createClient();
  return bacaAdmin(supabase);
});

/** Sama seperti getAdminSaatIni, tapi mengalihkan bila bukan admin aktif. */
export async function wajibAdmin(): Promise<AdminSaatIni> {
  const admin = await getAdminSaatIni();
  if (!admin) {
    // Route handler /keluar menghapus sesi (Server Component tidak bisa
    // menulis cookie), lalu kembali ke /login dengan pesan.
    redirect("/keluar?galat=bukan-admin");
  }
  return admin;
}

/** Dipakai juga oleh action login, dengan client yang baru saja masuk. */
export async function bacaAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AdminSaatIni | null> {
  const { data: klaim } = await supabase.auth.getClaims();
  const userId = klaim?.claims.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("admin")
    .select("nama, aktif, penugasan_peran(peran(kode, nama), kelompok(nomor, nama))")
    .eq("user_id", userId)
    .maybeSingle<BarisAdmin>();

  if (error || !data || !data.aktif) return null;

  const penugasan = data.penugasan_peran
    .filter((p) => p.peran !== null)
    .map((p) => ({
      peranKode: p.peran!.kode,
      peranNama: p.peran!.nama,
      kelompok: p.kelompok,
    }));

  if (penugasan.length === 0) return null;

  return { userId, nama: data.nama, penugasan };
}

/** Label singkat peran, mis. "Admin Kelompok · Kelompok 1". */
export function labelPenugasan(p: PenugasanAdmin): string {
  return p.kelompok ? `${p.peranNama} · ${p.kelompok.nama}` : p.peranNama;
}
