import { NextResponse, type NextRequest } from "next/server";
import { bacaParamRekap, getRekap } from "@/lib/absensi/rekap";
import { rekapKeCsv } from "@/lib/absensi/rekap-csv";

/** Ekspor rekap absensi (CSV untuk Excel/Sheets). Batas data tetap RLS. */
export async function GET(request: NextRequest) {
  const rekap = await getRekap(bacaParamRekap(Object.fromEntries(request.nextUrl.searchParams)), { ekspor: true });
  if (!rekap) return NextResponse.json({ galat: "Tidak berhak" }, { status: 403 });
  if ("galat" in rekap) return NextResponse.json(rekap, { status: 400 });
  return new NextResponse(rekapKeCsv(rekap), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${rekap.namaFile}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
