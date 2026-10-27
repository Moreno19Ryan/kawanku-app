/**
 * Penjelasan galat dalam bahasa sehari-hari untuk Pemantau galat (murni).
 * Dicocokkan dari pesan galat; bila tidak dikenali, null.
 */
export type Penjelasan = { arti: string; saran: string };

const POLA: { cocok: RegExp; arti: string; saran: string }[] = [
  {
    cocok: /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch dynamically/i,
    arti: "Browser pengguna masih memakai versi lama aplikasi saat versi baru terpasang.",
    saran: "Biasanya hilang sendiri setelah halaman dimuat ulang. Tidak perlu tindakan bila tidak terulang.",
  },
  {
    cocok: /Failed to fetch|NetworkError|network|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i,
    arti: "Koneksi internet atau koneksi ke server sempat terputus.",
    saran: "Biasanya sementara. Bila sering, periksa status Supabase/Vercel di Kesehatan sistem.",
  },
  {
    cocok: /timeout|timed out|statement timeout|canceling statement/i,
    arti: "Permintaan terlalu lama sehingga dihentikan.",
    saran: "Bila terulang di halaman yang sama, kemungkinan datanya besar atau kueri berat. Catat halamannya dan sampaikan ke Claude.",
  },
  {
    cocok: /JWT|refresh token|session|Auth session missing|invalid claim/i,
    arti: "Sesi masuk pengguna sudah berakhir atau tidak valid.",
    saran: "Wajar terjadi; pengguna cukup masuk kembali. Bila banyak sekaligus, periksa pengaturan Auth Supabase.",
  },
  {
    cocok: /row-level security|permission denied|42501|not authorized|Khusus pengembang/i,
    arti: "Pengguna mencoba mengakses data di luar wewenangnya (ditolak database).",
    saran: "Bila pengguna seharusnya berwenang, periksa peran & izinnya di Pengaturan → Peran & izin.",
  },
  {
    cocok: /duplicate key|23505|already exists/i,
    arti: "Data yang sama sudah ada (mis. username atau kode kembar).",
    saran: "Biasanya karena tombol simpan ditekan dua kali atau data dobel. Periksa datanya.",
  },
  {
    cocok: /foreign key|23503/i,
    arti: "Data masih terhubung dengan data lain (atau data induknya sudah tidak ada).",
    saran: "Periksa urutan hapus/ubahnya; data induk mungkin sudah dihapus.",
  },
  {
    cocok: /check constraint|23514|violates/i,
    arti: "Isian tidak sesuai aturan database.",
    saran: "Formulir seharusnya mencegah ini. Catat halamannya dan sampaikan ke Claude untuk diperbaiki.",
  },
  {
    cocok: /Hydration|did not match|hydrat/i,
    arti: "Tampilan di browser sedikit berbeda dengan yang disiapkan server.",
    saran: "Biasanya tidak mengganggu pengguna. Sampaikan ke Claude bila sering muncul.",
  },
  {
    cocok: /Cannot read propert|undefined is not|null is not|is not a function|TypeError/i,
    arti: "Ada bagian kode yang menerima data kosong atau tidak terduga.",
    saran: "Ini bug aplikasi. Catat halaman dan waktunya, lalu sampaikan ke Claude.",
  },
];

export function jelaskanGalat(pesan: string): Penjelasan | null {
  const p = POLA.find((x) => x.cocok.test(pesan));
  return p ? { arti: p.arti, saran: p.saran } : null;
}
