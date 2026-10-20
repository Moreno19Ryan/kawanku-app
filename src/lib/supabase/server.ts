import "server-only";
import { cookies } from "next/headers";
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
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

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
