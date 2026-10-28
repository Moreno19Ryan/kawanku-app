import { connection } from "next/server";

/**
 * GET /api/waktu → { sekarang } (milidetik, jam server). Dipakai jam
 * realtime (`src/components/waktu/jam-server.tsx`) supaya semua perangkat
 * menampilkan jam yang sama dengan jam pencatatan absensi, bukan jam
 * perangkat masing-masing. Tidak berisi data pribadi, jadi publik.
 */
export async function GET() {
  await connection();
  return Response.json({ sekarang: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
