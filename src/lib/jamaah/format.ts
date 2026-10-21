/** Format tampilan data jamaah (dipakai server & klien). */

/** "081234567890" → "0812-3456-7890". */
export function formatNoHp(no: string | null): string {
  if (!no) return "";
  return no.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** NIK/No. KK disamarkan: 3216••••••••0001. */
export function samarkan(nomor: string): string {
  return `${nomor.slice(0, 4)}${"•".repeat(8)}${nomor.slice(-4)}`;
}
