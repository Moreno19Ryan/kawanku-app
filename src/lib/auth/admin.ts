import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { keadaanMfa } from "./mfa";

export type PenugasanAdmin = {
  peranKode: string;
  peranNama: string;
  /** Peran khusus jamaah generus (admin generus). */
  hanyaGenerus: boolean;
  /** null = seluruh desa. */
  kelompok: { id: string; nomor: number; nama: string } | null;
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
  /**
   * Izin yang berlaku hanya di kelompok tertentu (penugasan dengan
   * kelompok_id, peran bukan hanya_generus): izin → daftar kelompok_id.
   */
  izinKelompok: Record<string, string[]>;
  /**
   * Semua izin dari semua penugasan, TERMASUK peran hanya_generus:
   * izin → daftar wilayah (null = seluruh desa). Untuk UX (menu, tombol);
   * sasaran generus tetap dibatasi RLS per jamaah.
   */
  izinWilayah: Record<string, (string | null)[]>;
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
      peran_izin: { izin_kode: string; izin: { hanya_kelompok: boolean } | null }[];
    } | null;
    kelompok: { id: string; nomor: number; nama: string } | null;
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
  // Verifikasi dua langkah: akun ber-MFA yang belum memasukkan kode tidak
  // bisa membaca data (kebijakan wajib_aal2), jadi minta kodenya dulu. Akun
  // pengembang wajib mendaftarkan MFA sebelum bisa memakai area admin.
  if (!admin || punyaIzin(admin, "sistem.kelola")) {
    const mfa = await keadaanMfa(await createClient());
    if (mfa.perluKode) redirect("/mfa");
    if (admin && !mfa.punyaMfa) redirect("/mfa/daftar");
  }
  if (!admin) {
    // Route handler /keluar menghapus sesi (Server Component tidak bisa
    // menulis cookie), lalu kembali ke /login dengan pesan yang sesuai:
    // sesi dicabut/kedaluwarsa, atau akun memang bukan admin aktif.
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      // Akun generus yang membuka area admin diarahkan ke halamannya sendiri.
      const { data: generus } = await supabase
        .from("akun_generus")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (generus) redirect("/saya");
    }
    redirect(data.user ? "/keluar?galat=bukan-admin" : "/keluar?galat=sesi-berakhir");
  }
  return admin;
}

/** Admin aktif yang memegang izin global `izin`; selain itu dialihkan. */
export async function wajibIzin(izin: string, alihkanKe = "/pengaturan"): Promise<AdminSaatIni> {
  const admin = await wajibAdmin();
  if (!punyaIzin(admin, izin)) redirect(alihkanKe);
  return admin;
}

/**
 * Boleh membuka Pengaturan → Admin & akses: akses.kelola (admin desa,
 * pengembang) atau akses.kelola_generus di kelompok mana pun (admin
 * kelompok, untuk akun admin generus kelompoknya). Detailnya dijaga RLS.
 */
export function bolehKelolaAkun(admin: AdminSaatIni): boolean {
  return punyaIzin(admin, "akses.kelola") || punyaIzinDiManaPun(admin, "akses.kelola_generus");
}

export async function wajibKelolaAkun(alihkanKe = "/pengaturan"): Promise<AdminSaatIni> {
  const admin = await wajibAdmin();
  if (!bolehKelolaAkun(admin)) redirect(alihkanKe);
  return admin;
}

export function punyaIzin(admin: AdminSaatIni, izin: string): boolean {
  return admin.izinGlobal.includes(izin);
}

/** Izin berlaku di kelompok ini (global atau lewat penugasan kelompok itu). */
export function punyaIzinDi(admin: AdminSaatIni, izin: string, kelompokId: string): boolean {
  return punyaIzin(admin, izin) || Boolean(admin.izinKelompok[izin]?.includes(kelompokId));
}

/** Izin berlaku di wilayah mana pun (global atau minimal satu kelompok). */
export function punyaIzinDiManaPun(admin: AdminSaatIni, izin: string): boolean {
  return punyaIzin(admin, izin) || (admin.izinKelompok[izin]?.length ?? 0) > 0;
}

/** Dipakai juga oleh action login, dengan client yang baru saja masuk. */
export async function bacaAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AdminSaatIni | null> {
  // getUser (bukan getClaims): ditanyakan ke Supabase Auth, jadi sesi yang
  // sudah dicabut (mis. "Keluar dari semua perangkat") langsung ditolak walau
  // access token-nya belum kedaluwarsa.
  const { data: dataUser } = await supabase.auth.getUser();
  const userId = dataUser.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("admin")
    .select(
      "nama, aktif, penugasan_peran(kelompok_id, peran(kode, nama, hanya_generus, peran_izin(izin_kode, izin(hanya_kelompok))), kelompok(id, nomor, nama))",
    )
    .eq("user_id", userId)
    .maybeSingle<BarisAdmin>();

  if (error || !data || !data.aktif) return null;

  const berlaku = data.penugasan_peran.filter((p) => p.peran !== null);
  if (berlaku.length === 0) return null;

  const izinGlobal = new Set<string>();
  const izinKelompok: Record<string, string[]> = {};
  const izinWilayah: Record<string, (string | null)[]> = {};
  for (const p of berlaku) {
    // Izin khusus kelompok (data jamaah) tidak berlaku dari penugasan desa,
    // sama dengan private.boleh().
    const izin = p.peran!.peran_izin.filter((i) => p.kelompok_id !== null || !i.izin?.hanya_kelompok);
    for (const { izin_kode } of izin) {
      (izinWilayah[izin_kode] ??= []).push(p.kelompok_id);
    }
    if (p.peran!.hanya_generus) continue;
    for (const { izin_kode } of izin) {
      if (p.kelompok_id === null) izinGlobal.add(izin_kode);
      else (izinKelompok[izin_kode] ??= []).push(p.kelompok_id);
    }
  }

  return {
    userId,
    nama: data.nama,
    email: dataUser.user?.email ?? null,
    penugasan: berlaku.map((p) => ({
      peranKode: p.peran!.kode,
      peranNama: p.peran!.nama,
      hanyaGenerus: p.peran!.hanya_generus,
      kelompok: p.kelompok,
    })),
    izinGlobal: [...izinGlobal],
    izinKelompok,
    izinWilayah,
  };
}

/** Semua perannya khusus generus (admin generus desa/kelompok). */
export function adalahAdminGenerus(admin: AdminSaatIni): boolean {
  return admin.penugasan.every((p) => p.hanyaGenerus);
}

/**
 * Siapa yang mengelola akun ini (sama dengan private.boleh_kelola_akun):
 * admin generus kelompok → admin kelompoknya; selain itu → admin desa.
 */
export function pengelolaAkun(admin: AdminSaatIni): string {
  if (punyaIzin(admin, "sistem.kelola")) return "Pengembang";
  const kelompok = admin.penugasan.every((p) => p.hanyaGenerus && p.kelompok)
    ? [...new Set(admin.penugasan.map((p) => p.kelompok!.nama))]
    : [];
  return kelompok.length > 0 ? `Admin ${kelompok.join(" / ")}` : "Admin desa";
}

/** Label singkat peran, mis. "Admin Kelompok · Kelompok 1". */
export function labelPenugasan(p: PenugasanAdmin): string {
  return p.kelompok ? `${p.peranNama} · ${p.kelompok.nama}` : p.peranNama;
}
