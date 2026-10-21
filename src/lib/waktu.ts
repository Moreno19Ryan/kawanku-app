const ZONA = "Asia/Jakarta";

/** "3 hari yang lalu", "kemarin", "5 menit yang lalu" (Bahasa Indonesia). */
export function waktuRelatif(iso: string, sekarang = Date.now()): string {
  const detik = Math.round((new Date(iso).getTime() - sekarang) / 1000);
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const satuan: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, s] of satuan) {
    if (Math.abs(detik) >= s) return rtf.format(Math.round(detik / s), unit);
  }
  return "baru saja";
}

/** "21 Okt 2026 08.15 WIB" — zona waktu desa, bukan zona server. */
export function tanggalJam(iso: string): string {
  return `${new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONA,
  }).format(new Date(iso))} WIB`;
}
