"use server";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilMasukGenerus =
  | { galat: string }
  | { email: string; password: string; pinAwal: boolean };

const SALAH = "Mohon maaf, username atau PIN belum cocok. Silakan dicoba lagi.";

function jamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

/**
 * Langkah pertama login generus. PIN diperiksa di database oleh server
 * (cek_pin_generus, hanya service_role): salah 5x berturut-turut → akun
 * dikunci 15 menit, dan kuncinya tidak bisa dilewati dari browser.
 *
 * Bila PIN benar, kata sandi Auth akun itu diganti dengan nilai acak baru
 * dan dikembalikan ke browser, yang lalu login sendiri (signInWithPassword)
 * supaya batas percobaan Supabase dihitung per perangkat, bukan per server.
 * Kata sandi Auth tidak pernah sama dengan PIN, jadi PIN tidak bisa dipakai
 * login langsung ke Supabase tanpa lewat aplikasi.
 */
export async function siapkanMasukGenerus(username: string, pin: string): Promise<HasilMasukGenerus> {
  const u = String(username ?? "").trim().toLowerCase().slice(0, 40);
  const p = String(pin ?? "").trim();
  if (!u || !/^\d{6}$/.test(p)) return { galat: "Mohon isi username dan PIN 6 angka." };

  const admin = createAdminClient();
  if (!admin) return { galat: "Mohon maaf, masuk generus belum disiapkan di server. Silakan hubungi pengembang." };

  const { data, error } = await admin
    .rpc("cek_pin_generus", { p_username: u, p_pin: p })
    .maybeSingle<{ hasil: "ok" | "salah" | "terkunci"; user_id: string | null; email: string | null; pin_awal: boolean | null; terkunci_sampai: string | null }>();
  if (error || !data) return { galat: "Mohon maaf, server belum bisa dihubungi. Silakan coba lagi sebentar lagi." };
  if (data.hasil === "terkunci") {
    return {
      galat: `Mohon maaf, PIN belum cocok 5 kali, jadi akun dikunci sementara sampai ${data.terkunci_sampai ? `pukul ${jamWib(data.terkunci_sampai)}` : "beberapa menit lagi"}. Silakan coba lagi setelahnya.`,
    };
  }
  if (data.hasil !== "ok" || !data.user_id || !data.email) return { galat: SALAH };

  const password = randomBytes(24).toString("base64url");
  const { error: galatAuth } = await admin.auth.admin.updateUserById(data.user_id, { password });
  if (galatAuth) return { galat: "Mohon maaf, belum berhasil masuk. Silakan dicoba lagi." };
  return { email: data.email, password, pinAwal: Boolean(data.pin_awal) };
}
