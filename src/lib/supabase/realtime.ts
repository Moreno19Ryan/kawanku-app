import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Berlangganan kanal Realtime SETELAH token login terpasang. Tanpa ini
 * kanal bisa bergabung sebagai anon (sesi belum terbaca saat halaman baru
 * dimuat) sehingga Realtime menolaknya (RLS). Mengembalikan fungsi untuk
 * berhenti berlangganan (aman dipanggil sebelum kanal siap).
 */
export function langganan(
  supabase: SupabaseClient,
  nama: string,
  pasang: (kanal: RealtimeChannel) => RealtimeChannel,
): () => void {
  let kanal: RealtimeChannel | null = null;
  let berhenti = false;
  void (async () => {
    // Baca sesi (dari cookie) dulu, lalu pasang tokennya ke Realtime lewat
    // jalur otomatis (ikut diperbarui saat token login diperpanjang).
    await supabase.auth.getSession();
    await supabase.realtime.setAuth();
    if (berhenti) return;
    kanal = pasang(supabase.channel(nama)).subscribe();
  })();
  return () => {
    berhenti = true;
    if (kanal) void supabase.removeChannel(kanal);
  };
}
