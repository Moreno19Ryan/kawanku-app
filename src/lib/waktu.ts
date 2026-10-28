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

/** "19.02" — jam dan menit WIB. */
export function jam(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: ZONA }).format(new Date(iso));
}

/** ISO → nilai <input type="datetime-local"> dalam WIB ("2026-10-21T08:15"). */
export function keInputWib(iso: string | null): string {
  if (!iso) return "";
  // sv-SE menghasilkan "YYYY-MM-DD HH:mm".
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA,
  })
    .format(new Date(iso))
    .replace(" ", "T");
}

/** Nilai <input type="datetime-local"> (dianggap WIB) → ISO, atau null bila kosong/tidak valid. */
export function dariInputWib(nilai: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nilai)) return null;
  const waktu = new Date(`${nilai}:00+07:00`);
  return Number.isNaN(waktu.getTime()) ? null : waktu.toISOString();
}

/** Tanggal (YYYY-MM-DD, tanpa jam) → "5 Maret 2008". */
export function tanggalPanjang(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** "19.24.08" — jam, menit, detik WIB. */
export function jamDetik(waktu: string | number): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: ZONA,
  }).format(new Date(waktu));
}

/** "Rabu, 28 Oktober 2026" (WIB). */
export function hariTanggal(waktu: string | number): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA,
  }).format(new Date(waktu));
}
