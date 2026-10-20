import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Client Supabase dengan secret key (service role): MELEWATI RLS.
 *
 * Hanya untuk Supabase Auth Admin API (membuat akun, mengatur ulang kata
 * sandi, membaca email admin), dan hanya dipanggil SETELAH pemanggil
 * terbukti memegang izin akses.kelola. Data aplikasi (tabel public) tetap
 * ditulis dengan client sesi pengguna supaya tetap lewat RLS.
 *
 * Key dibaca dari SUPABASE_SECRET_KEY (env server di Vercel, bukan
 * NEXT_PUBLIC_*). Jangan pernah mengomit atau mencetak nilainya.
 * Null bila belum dikonfigurasi.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secretKey) return null;

  return createClient(env.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Apakah fitur yang butuh secret key bisa dipakai. */
export function adaSecretKey() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
