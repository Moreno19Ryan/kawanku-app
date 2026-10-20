import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Me-refresh sesi Supabase Auth di setiap request dan menulis ulang cookie
 * sesi ke response. Dipanggil dari src/proxy.ts (pengganti middleware di
 * Next.js 16).
 *
 * Fase 0: hanya refresh sesi. Proteksi rute (redirect ke /login) ditambahkan
 * bersama alur login admin di fase berikutnya.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) {
    // Env belum diisi (mis. preview pertama): biarkan halaman tetap tampil.
    return response;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Jangan taruh kode apa pun di antara createServerClient dan getClaims():
  // panggilan ini yang memvalidasi dan me-refresh token.
  await supabase.auth.getClaims();

  return response;
}
