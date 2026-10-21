/** "Nadia Putri" → "nadia.putri" (huruf kecil, angka, titik; maks. 30). */
export function slugUsername(nama: string): string {
  return nama
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30)
    .replace(/\.+$/, "");
}

/** Usulan username: dari nama panggilan, lalu nama lengkap. */
export function usulanUsername(j: { kode: string; nama_lengkap: string; nama_panggilan: string | null }): string[] {
  const daftar = [j.nama_panggilan, j.nama_lengkap]
    .map((n) => (n ? slugUsername(n) : ""))
    .filter((u) => u.length >= 3);
  return [...new Set(daftar.length ? daftar : [slugUsername(j.kode)])];
}
