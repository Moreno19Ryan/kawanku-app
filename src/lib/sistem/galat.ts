import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient as createClientSesi } from "@/lib/supabase/server";
import { normalisasiRute } from "./rute-galat";

export type CatatanGalat = {
  sumber: "server" | "klien";
  pesan: string;
  rute?: string | null;
  jenis?: string | null;
  digest?: string | null;
};

const argumen = (g: CatatanGalat) => ({
  p_sumber: g.sumber,
  p_pesan: g.pesan.slice(0, 500),
  p_rute: g.rute ? normalisasiRute(g.rute) : null,
  p_jenis: g.jenis?.slice(0, 30) ?? null,
  p_digest: g.digest?.slice(0, 100) ?? null,
});

/**
 * Catat galat server (dari onRequestError) lewat RPC catat_galat dengan
 * publishable key, tanpa sesi pengguna. Tidak pernah melempar galat:
 * pemantau tidak boleh menambah masalah.
 */
export async function catatGalatServer(g: CatatanGalat): Promise<void> {
  try {
    const env = getSupabaseEnv();
    if (!env) return;
    const supabase = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await supabase.rpc("catat_galat", argumen(g));
  } catch {
    // diabaikan
  }
}

/** Catat galat dari halaman galat di browser (dengan sesi pengguna bila ada). */
export async function catatGalatSesi(g: CatatanGalat): Promise<void> {
  try {
    const supabase = await createClientSesi();
    await supabase.rpc("catat_galat", argumen(g));
  } catch {
    // diabaikan
  }
}
