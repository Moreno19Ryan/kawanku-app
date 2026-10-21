import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAdminSaatIni } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export type GenerusSaatIni = {
  userId: string;
  username: string;
  pinAwal: boolean;
  jamaah: { id: string; kode: string; nama: string; panggilan: string | null; kelompok: string | null };
};

type Baris = {
  username: string;
  pin_awal: boolean;
  jamaah: {
    id: string;
    kode: string;
    nama_lengkap: string;
    nama_panggilan: string | null;
    aktif: boolean;
    kelompok: { nama: string } | null;
  } | null;
};

/**
 * Akun generus yang sedang login (null bila belum login, bukan generus, atau
 * akun/jamaahnya nonaktif). Membaca cookie sesi → harus di dalam <Suspense>.
 */
export const getGenerusSaatIni = cache(async (): Promise<GenerusSaatIni | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("akun_generus")
    .select("username, pin_awal, jamaah:jamaah_id(id, kode, nama_lengkap, nama_panggilan, aktif, kelompok:kelompok_id(nama))")
    .eq("user_id", auth.user.id)
    .eq("aktif", true)
    .maybeSingle<Baris>();
  if (!data?.jamaah?.aktif) return null;
  return {
    userId: auth.user.id,
    username: data.username,
    pinAwal: data.pin_awal,
    jamaah: {
      id: data.jamaah.id,
      kode: data.jamaah.kode,
      nama: data.jamaah.nama_lengkap,
      panggilan: data.jamaah.nama_panggilan,
      kelompok: data.jamaah.kelompok?.nama ?? null,
    },
  };
});

/** Generus aktif; selain itu ke halaman masuk generus. PIN awal wajib diganti dulu. */
export async function wajibGenerus(opsi: { bolehPinAwal?: boolean } = {}): Promise<GenerusSaatIni> {
  const generus = await getGenerusSaatIni();
  if (!generus) {
    // Admin yang membuka halaman generus kembali ke area admin (tanpa logout).
    if (await getAdminSaatIni()) redirect("/dashboard");
    redirect("/keluar?galat=bukan-generus");
  }
  if (generus.pinAwal && !opsi.bolehPinAwal) redirect("/saya/pin");
  return generus;
}

/** PIN awal bawaan dari tanggal lahir: DDMMYY. Null bila tanggal lahir belum lengkap. */
export function pinDariTanggalLahir(tanggal: string | null): string | null {
  const m = tanggal?.match(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/);
  return m ? `${m[4]}${m[3]}${m[2]}` : null;
}

