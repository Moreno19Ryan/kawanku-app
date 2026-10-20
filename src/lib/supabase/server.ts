import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client untuk Server Components, Server Actions, dan Route Handlers.
 * Buat client baru per request; jangan simpan di variabel global.
 *
 * Catatan cacheComponents: komponen yang memanggil ini membaca cookies(),
 * jadi harus berada di dalam <Suspense>.
 */
export async function createClient() {
  // Selalu saat request, tidak pernah saat prerender: build mungkin tanpa env
  // Supabase, dan supabase-js memakai Date.now() untuk cek kedaluwarsa sesi.
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Dipanggil dari Server Component (cookie read-only). Aman diabaikan
          // karena proxy sudah me-refresh sesi di setiap request.
        }
      },
    },
  });
}
