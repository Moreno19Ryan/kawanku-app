"use server";

import { refresh } from "next/cache";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

const TIDAK_BERHAK: StateAksi = { galat: "Mohon maaf, fitur ini khusus pengembang." };

async function konteks() {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || !punyaIzin(admin, "sistem.kelola")) return null;
  return { supabase, admin };
}

/** Hapus kunci 5x PIN salah pada akun generus. */
export async function bukaKunciAkun(userId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await ctx.supabase.rpc("buka_kunci_akun", { p_user_id: userId });
  if (error) return { galat: "Mohon maaf, kunci belum berhasil dibuka. Silakan coba lagi." };
  refresh();
  return { pesan: "Alhamdulillah, kunci dibuka. Generus bisa langsung mencoba masuk lagi." };
}

/** Akhiri semua sesi masuk akun (mis. HP hilang). Akun tetap aktif. */
export async function keluarkanAkun(userId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase.rpc("keluarkan_akun", { p_user_id: userId });
  if (error) return { galat: "Mohon maaf, akun belum berhasil dikeluarkan. Silakan coba lagi." };
  refresh();
  return { pesan: `Alhamdulillah, ${Number(data ?? 0)} sesi diakhiri.` };
}
