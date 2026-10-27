/**
 * "Salin laporan masalah" (Panel pengembang): bahan yang dikumpulkan server →
 * satu teks rapi untuk ditempel ke chat asisten pengembang. Murni (tanpa I/O).
 *
 * Sengaja TANPA data pribadi jamaah: jejak hanya nama tabel/kolom (tanpa
 * label nama), pemeriksaan data hanya jumlah (tanpa contoh nama).
 */

import { jelaskanGalat } from "./galat-jelas";
import { namaKolom, namaTabel, NAMA_AKSI } from "./jejak";
import { nilaiKesehatan, type DataKesehatan } from "./kesehatan";
import { tanggalJam } from "@/lib/waktu";

export const PILIHAN_RENTANG = [
  { jam: 6, label: "6 jam terakhir" },
  { jam: 24, label: "24 jam terakhir" },
  { jam: 72, label: "3 hari terakhir" },
  { jam: 168, label: "7 hari terakhir" },
] as const;

export const BATAS_CERITA = 2000;

export type GalatLaporan = {
  sumber: string;
  jenis: string | null;
  rute: string | null;
  pesan: string;
  digest: string | null;
  jumlah: number;
  pertama_at: string;
  terakhir_at: string;
  dicek_at: string | null;
};

export type JejakLaporan = {
  tabel: string;
  aksi: string;
  kolom: string[] | null;
  /** Nama admin, "Generus/akun lain", atau "Sistem". */
  oleh: string;
  created_at: string;
};

export type BahanLaporan = {
  dibuat: string;
  rentangJam: number;
  cerita: string | null;
  pelapor: string;
  versi: { lingkungan: string; commit: string | null; pesanCommit: string | null; region: string | null };
  perawatan: boolean | null;
  kesehatan: DataKesehatan | null;
  periksa: { judul: string; jumlah: number }[] | null;
  galat: GalatLaporan[] | null;
  jejak: JejakLaporan[] | null;
  /** Jumlah seluruh jejak dalam rentang (daftar `jejak` bisa dipotong). */
  jejakTotal: number | null;
};

const TIDAK_TERBACA = "(tidak terbaca)";

function judulRentang(jam: number): string {
  return PILIHAN_RENTANG.find((p) => p.jam === jam)?.label ?? `${jam} jam terakhir`;
}

export function susunLaporan(b: BahanLaporan, sekarang = Date.parse(b.dibuat)): string {
  const baris: string[] = [];
  const tambah = (...s: string[]) => baris.push(...s);

  tambah(
    "# Laporan masalah KawanKu",
    `Dibuat: ${tanggalJam(b.dibuat)} oleh ${b.pelapor}`,
    `Rentang: ${judulRentang(b.rentangJam)}`,
    `Versi: ${b.versi.commit?.slice(0, 7) ?? "–"}${b.versi.pesanCommit ? ` (${b.versi.pesanCommit})` : ""}`,
    `Lingkungan: ${b.versi.lingkungan}${b.versi.region ? ` · ${b.versi.region}` : ""}`,
    `Mode perawatan: ${b.perawatan === null ? TIDAK_TERBACA : b.perawatan ? "AKTIF" : "mati"}`,
    "",
    "## Cerita",
    b.cerita?.trim() || "(tidak diisi)",
    "",
  );

  tambah("## Kesehatan sistem");
  if (!b.kesehatan) {
    tambah(TIDAK_TERBACA);
  } else {
    for (const butir of nilaiKesehatan(b.kesehatan, sekarang)) {
      tambah(`- [${butir.tingkat}] ${butir.judul}: ${butir.isi}`);
    }
    tambah("", "Tugas otomatis:");
    for (const t of b.kesehatan.tugas) {
      const akhir = t.terakhir_at ? `${tanggalJam(t.terakhir_at)} ${t.terakhir_status ?? ""}`.trim() : "belum pernah";
      tambah(
        `- ${t.nama}${t.aktif ? "" : " (DIMATIKAN)"}: terakhir ${akhir}; 24 jam ${t.jalan_24j}× jalan, ${t.gagal_24j}× gagal`,
      );
      if (t.terakhir_status === "failed" && t.terakhir_pesan) tambah(`  Pesan: ${t.terakhir_pesan}`);
    }
  }
  tambah("");

  tambah("## Pemeriksaan data");
  if (!b.periksa) {
    tambah(TIDAK_TERBACA);
  } else {
    const temuan = b.periksa.filter((p) => p.jumlah > 0);
    if (temuan.length === 0) tambah("Tidak ada temuan.");
    for (const p of temuan) tambah(`- ${p.judul}: ${p.jumlah}`);
  }
  tambah("");

  tambah("## Galat (belum dicek, atau terjadi dalam rentang)");
  if (!b.galat) {
    tambah(TIDAK_TERBACA);
  } else if (b.galat.length === 0) {
    tambah("Tidak ada.");
  } else {
    b.galat.forEach((g, i) => {
      tambah(
        `${i + 1}. [${g.sumber}${g.jenis ? `/${g.jenis}` : ""}] ${g.rute ?? "(rute tidak diketahui)"}`,
        `   Pesan: ${g.pesan}`,
        `   ${g.jumlah}× · pertama ${tanggalJam(g.pertama_at)} · terakhir ${tanggalJam(g.terakhir_at)}` +
          `${g.dicek_at ? " · sudah dicek" : ""}${g.digest ? ` · digest ${g.digest}` : ""}`,
      );
      const arti = jelaskanGalat(g.pesan);
      if (arti) tambah(`   Dugaan aplikasi: ${arti.arti}`);
    });
  }
  tambah("");

  tambah("## Jejak aktivitas");
  if (!b.jejak) {
    tambah(TIDAK_TERBACA);
  } else if (b.jejak.length === 0) {
    tambah("Tidak ada perubahan data dalam rentang ini.");
  } else {
    const ringkas = new Map<string, number>();
    for (const j of b.jejak) {
      const kunci = `${NAMA_AKSI[j.aksi] ?? j.aksi} ${namaTabel(j.tabel)}`;
      ringkas.set(kunci, (ringkas.get(kunci) ?? 0) + 1);
    }
    const total = b.jejakTotal ?? b.jejak.length;
    tambah(
      `Ringkasan (${b.jejak.length < total ? `${b.jejak.length} terbaru dari ${total}` : total}):`,
      ...[...ringkas].sort((x, y) => y[1] - x[1]).map(([k, n]) => `- ${k}: ${n}`),
      "",
      "Terbaru:",
    );
    // Baris berurutan yang sama persis (mis. tugas otomatis) diringkas jadi "×n".
    const terbaru: { teks: string; kali: number }[] = [];
    for (const j of b.jejak.slice(0, 60)) {
      const kolom = j.kolom?.length ? ` (${j.kolom.map(namaKolom).join(", ")})` : "";
      const teks = `${tanggalJam(j.created_at)} · ${NAMA_AKSI[j.aksi] ?? j.aksi} ${namaTabel(j.tabel)}${kolom} · ${j.oleh}`;
      const akhir = terbaru.at(-1);
      if (akhir?.teks === teks) akhir.kali++;
      else terbaru.push({ teks, kali: 1 });
    }
    for (const t of terbaru.slice(0, 30)) tambah(`- ${t.teks}${t.kali > 1 ? ` (×${t.kali})` : ""}`);
  }
  tambah("", "(Jejak dan pemeriksaan data sengaja tanpa nama, kontak, atau NIK jamaah.)");

  return baris.join("\n");
}
