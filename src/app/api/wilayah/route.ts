import { anakWilayah, POLA_KODE_WILAYAH } from "@/lib/wilayah";

/**
 * GET /api/wilayah?induk=32.16 → [{ kode, nama }] di bawahnya (tanpa induk:
 * daftar provinsi). Data publik (kode wilayah Kemendagri), boleh di-cache.
 */
export async function GET(request: Request) {
  const induk = new URL(request.url).searchParams.get("induk") ?? "";
  if (induk && (!POLA_KODE_WILAYAH.test(induk) || induk.split(".").length >= 4)) {
    return Response.json({ galat: "Kode induk tidak valid." }, { status: 400 });
  }
  return Response.json(anakWilayah(induk), {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
  });
}
