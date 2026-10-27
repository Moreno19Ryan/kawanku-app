/**
 * Jenis perangkat yang sedang membuka KawanKu, supaya teks & perilaku
 * sesuai ("Ingat username di laptop ini", "Klik" vs "Ketuk"). Murni: dipakai
 * hook `usePerangkat()` di browser. Komputer meja ikut "laptop" (keduanya
 * berlayar lebar + papan ketik; tidak bisa dibedakan dari browser).
 */
export type JenisPerangkat = "hp" | "tablet" | "laptop";

/**
 * @param ua user agent
 * @param sentuh `navigator.maxTouchPoints` (iPad modern mengaku "Macintosh")
 * @param mobile `navigator.userAgentData.mobile` bila browser menyediakannya
 */
export function kenaliPerangkat(ua: string, sentuh = 0, mobile?: boolean): JenisPerangkat {
  if (/iPad/.test(ua) || (ua.includes("Macintosh") && sentuh > 1)) return "tablet";
  if (/iPhone|iPod/.test(ua)) return "hp";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "hp" : "tablet";
  if (mobile || /Mobi|Windows Phone|BlackBerry|Opera Mini/.test(ua)) return "hp";
  if (/Tablet|Silk|Kindle|PlayBook/.test(ua)) return "tablet";
  return "laptop";
}

const NAMA: Record<JenisPerangkat, string> = { hp: "HP", tablet: "tablet", laptop: "laptop" };

/** "HP" / "tablet" / "laptop"; `null` (belum diketahui, mis. saat render server) → "perangkat". */
export function namaPerangkat(jenis: JenisPerangkat | null): string {
  return jenis ? NAMA[jenis] : "perangkat";
}

/** Kata kerja menekan: "Klik" di laptop, "Ketuk" di layar sentuh, "Pilih" bila belum diketahui. */
export function kataTekan(jenis: JenisPerangkat | null): "Klik" | "Ketuk" | "Pilih" {
  if (!jenis) return "Pilih";
  return jenis === "laptop" ? "Klik" : "Ketuk";
}
