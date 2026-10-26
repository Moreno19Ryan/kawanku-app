import { NextResponse, type NextRequest } from "next/server";
import { buatCadangan, getWilayahCadangan } from "@/lib/cadangan/buat";
import { createClient } from "@/lib/supabase/server";

/**
 * Unduh cadangan data satu wilayah (Excel, tanpa NIK/No. KK). Isi file
 * mengikuti RLS sesi pengguna; setiap unduhan dicatat di unduhan_cadangan
 * lebih dulu (gagal mencatat = file tidak diberikan).
 */
export async function GET(request: NextRequest) {
  const akses = await getWilayahCadangan();
  if (!akses) return NextResponse.json({ galat: "Belum masuk" }, { status: 401 });
  const wilayah = akses.pilihan.find((w) => w.nilai === request.nextUrl.searchParams.get("wilayah"));
  if (!wilayah) return NextResponse.json({ galat: "Tidak berhak" }, { status: 403 });

  const supabase = await createClient();
  let hasil: Awaited<ReturnType<typeof buatCadangan>>;
  try {
    hasil = await buatCadangan(supabase, wilayah, akses.admin.nama);
  } catch {
    return NextResponse.json({ galat: "Gagal membuat cadangan" }, { status: 500 });
  }
  const { error } = await supabase
    .from("unduhan_cadangan")
    .insert({ kelompok_id: wilayah.kelompokId, ringkasan: hasil.ringkasan });
  if (error) return NextResponse.json({ galat: "Tidak berhak" }, { status: 403 });

  const tanggal = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
  const nama = wilayah.nama.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(hasil.file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cadangan-kawanku-${nama}-${tanggal}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
