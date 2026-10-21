/** "Abdul Aziz Syahputra" → "abdulazizsyahputra" (huruf kecil & angka saja; maks. 30). */
export function slugUsername(nama: string): string {
  return nama
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

/** Usulan username: nama lengkap dulu, lalu nama panggilan. */
export function usulanUsername(j: { kode: string; nama_lengkap: string; nama_panggilan: string | null }): string[] {
  const daftar = [j.nama_lengkap, j.nama_panggilan]
    .map((n) => (n ? slugUsername(n) : ""))
    .filter((u) => u.length >= 3);
  return [...new Set(daftar.length ? daftar : [slugUsername(j.kode)])];
}
