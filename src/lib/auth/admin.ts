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
  email: string | null;
  penugasan: PenugasanAdmin[];
  /**
   * Izin yang berlaku untuk seluruh desa, sama dengan private.boleh(izin, null):
   * hanya dari penugasan tanpa kelompok_id dan peran yang bukan hanya_generus.
   */
  izinGlobal: string[];
};

type BarisAdmin = {
  nama: string;
  aktif: boolean;
  penugasan_peran: {
    kelompok_id: string | null;
    peran: {
      kode: string;
      nama: string;
      hanya_generus: boolean;
      peran_izin: { izin_kode: string }[];
    } | null;
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

/** Admin aktif yang memegang izin global `izin`; selain itu dialihkan. */
export async function wajibIzin(izin: string, alihkanKe = "/pengaturan"): Promise<AdminSaatIni> {
  const admin = await wajibAdmin();
  if (!punyaIzin(admin, izin)) redirect(alihkanKe);
  return admin;
}

export function punyaIzin(admin: AdminSaatIni, izin: string): boolean {
  return admin.izinGlobal.includes(izin);
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
    .select(
      "nama, aktif, penugasan_peran(kelompok_id, peran(kode, nama, hanya_generus, peran_izin(izin_kode)), kelompok(nomor, nama))",
    )
    .eq("user_id", userId)
    .maybeSingle<BarisAdmin>();

  if (error || !data || !data.aktif) return null;

  const berlaku = data.penugasan_peran.filter((p) => p.peran !== null);
  if (berlaku.length === 0) return null;

  const izinGlobal = new Set<string>();
  for (const p of berlaku) {
    if (p.kelompok_id === null && !p.peran!.hanya_generus) {
      p.peran!.peran_izin.forEach((i) => izinGlobal.add(i.izin_kode));
    }
  }

  return {
    userId,
    nama: data.nama,
    email: typeof klaim.claims.email === "string" ? klaim.claims.email : null,
    penugasan: berlaku.map((p) => ({
      peranKode: p.peran!.kode,
      peranNama: p.peran!.nama,
      kelompok: p.kelompok,
    })),
    izinGlobal: [...izinGlobal],
  };
}

/** Label singkat peran, mis. "Admin Kelompok · Kelompok 1". */
export function labelPenugasan(p: PenugasanAdmin): string {
  return p.kelompok ? `${p.peranNama} · ${p.kelompok.nama}` : p.peranNama;
}
