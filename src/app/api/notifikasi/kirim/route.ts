import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { kirimPush, type PesanPush } from "@/lib/notifikasi/kirim";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Dipanggil database (pg_cron → pg_net, private.kirim_notifikasi) tiap
 * 5 menit dengan daftar pengingat yang jatuh tempo. Dilindungi rahasia
 * bersama (env NOTIFIKASI_RAHASIA = secret Vault kawanku_notifikasi_rahasia).
 */
export async function POST(request: Request) {
  const rahasia = process.env.NOTIFIKASI_RAHASIA;
  const masuk = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!rahasia || !sama(masuk, rahasia)) {
    return Response.json({ galat: "Tidak berhak" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { pesan?: unknown } | null;
  const pesan = Array.isArray(body?.pesan) ? (body.pesan as PesanPush[]).filter(valid).slice(0, 2000) : [];
  const hasil = await kirimPush(pesan);

  const env = getSupabaseEnv();
  if (env && (hasil.terkirim.length || hasil.kedaluwarsa.length)) {
    const supabase = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await supabase.rpc("hasil_kirim_notifikasi", {
      p_rahasia: rahasia,
      p_terkirim: hasil.terkirim,
      p_kedaluwarsa: hasil.kedaluwarsa,
    });
  }
  return Response.json({ terkirim: hasil.terkirim.length, kedaluwarsa: hasil.kedaluwarsa.length, gagal: hasil.gagal });
}

function sama(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function valid(p: unknown): p is PesanPush {
  const x = p as PesanPush;
  return (
    typeof x?.endpoint === "string" &&
    x.endpoint.startsWith("https://") &&
    typeof x.p256dh === "string" &&
    typeof x.auth === "string" &&
    typeof x.judul === "string" &&
    typeof x.isi === "string"
  );
}
