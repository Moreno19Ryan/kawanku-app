import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Klien = Awaited<ReturnType<typeof createClient>>;

/**
 * Keadaan verifikasi dua langkah (MFA/TOTP) sesi ini:
 * - `perluKode`: akun punya MFA tapi sesi belum memasukkan kode (aal1 → aal2).
 * - `punyaMfa`: akun sudah punya MFA terverifikasi.
 * Dibaca dari token sesi (tanpa panggilan jaringan).
 */
export async function keadaanMfa(supabase: Klien): Promise<{ perluKode: boolean; punyaMfa: boolean }> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const punyaMfa = data?.nextLevel === "aal2";
  return { perluKode: punyaMfa && data?.currentLevel !== "aal2", punyaMfa };
}
