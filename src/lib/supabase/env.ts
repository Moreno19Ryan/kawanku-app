/**
 * Konfigurasi publik Supabase. Hanya NEXT_PUBLIC_* yang boleh dibaca di sini;
 * nilainya ikut ter-bundle ke browser.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Salin .env.example ke .env.local.",
    );
  }
  return env;
}
