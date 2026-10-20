import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** Supabase client untuk Client Components (berjalan di browser). */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
