import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Menghapus sesi lalu kembali ke /login. Dipakai saat sesi ada tapi bukan
 * admin aktif (lihat wajibAdmin), karena Server Component tidak bisa menulis
 * cookie. Jangan ditautkan dengan <Link> (prefetch akan ikut logout); tombol
 * "Keluar" memakai Server Action keluar().
 */
export async function GET(request: NextRequest) {
  // Baca request dulu supaya route ini dinamis (tidak di-prerender saat build).
  const url = request.nextUrl.clone();
  const bukanAdmin = url.searchParams.get("galat") === "bukan-admin";
  url.pathname = "/login";
  url.search = "";
  if (bukanAdmin) url.searchParams.set("galat", "bukan-admin");

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(url);
}
