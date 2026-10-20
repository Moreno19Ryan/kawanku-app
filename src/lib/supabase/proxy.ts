import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Me-refresh sesi Supabase Auth di setiap request dan menulis ulang cookie
 * sesi ke response. Dipanggil dari src/proxy.ts (pengganti middleware di
 * Next.js 16).
 *
 * Juga proteksi rute optimistis: tanpa sesi → /login?next=...; sudah login
 * tapi membuka /login → /dashboard. Pemeriksaan "admin aktif" ada di
 * layout (wajibAdmin), dan batas akses data tetap RLS.
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
  const { data } = await supabase.auth.getClaims();
  const masuk = Boolean(data?.claims.sub);
  const { pathname, search } = request.nextUrl;
  const publik = RUTE_PUBLIK.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (!masuk && !publik) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return alihkan(url, response);
  }

  if (masuk && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return alihkan(url, response);
  }

  return response;
}

/** Rute yang boleh dibuka tanpa sesi. */
const RUTE_PUBLIK = ["/login", "/keluar"];

/** Redirect yang tetap membawa cookie sesi hasil refresh. */
function alihkan(url: URL, dari: NextResponse) {
  const redirect = NextResponse.redirect(url);
  dari.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
