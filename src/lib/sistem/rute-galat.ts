/**
 * Rute untuk pemantau galat: tanpa query string (bisa berisi kata cari)
 * dan id diganti `[id]`, supaya galat yang sama di halaman berbeda
 * digabung dan tidak ada id/data yang ikut tercatat. Murni (server & klien).
 */
export function normalisasiRute(path: string): string {
  return (
    path
      .split(/[?#]/)[0]
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
      .replace(/\/\d{3,}(?=\/|$)/g, "/[n]")
      .slice(0, 200) || "/"
  );
}
