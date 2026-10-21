import "server-only";
import { DATA_WILAYAH } from "./data";

export type Wilayah = { kode: string; nama: string };

/** Pola kode: provinsi 32, kab/kota 32.16, kecamatan 32.16.07, desa 32.16.07.1001. */
export const POLA_KODE_WILAYAH = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

let peta: Map<string, string> | null = null;
let anak: Map<string, Wilayah[]> | null = null;

/** Diurai sekali per instance server (data statis ±2 MB). */
function muat() {
  if (peta && anak) return { peta, anak };
  peta = new Map();
  anak = new Map();
  for (const baris of DATA_WILAYAH.split("\n")) {
    const [kode, nama] = baris.split("\t");
    if (!kode || !nama) continue;
    peta.set(kode, nama);
    const induk = kode.includes(".") ? kode.slice(0, kode.lastIndexOf(".")) : "";
    const daftar = anak.get(induk) ?? [];
    daftar.push({ kode, nama });
    anak.set(induk, daftar);
  }
  for (const daftar of anak.values()) daftar.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { peta, anak };
}

/** Wilayah di bawah `induk` ("" = daftar provinsi). */
export function anakWilayah(induk: string): Wilayah[] {
  return muat().anak.get(induk) ?? [];
}

export function adaWilayah(kode: string): boolean {
  return POLA_KODE_WILAYAH.test(kode) && muat().peta.has(kode);
}

/**
 * Nama lengkap dari tingkat terdalam ke provinsi, mis.
 * "Wanasari, Cibitung, Kabupaten Bekasi, Jawa Barat". Null bila kode tidak dikenal.
 */
export function namaLengkapWilayah(kode: string): string | null {
  if (!adaWilayah(kode)) return null;
  const { peta } = muat();
  const bagian: string[] = [];
  const potong = kode.split(".");
  for (let i = potong.length; i > 0; i--) {
    const nama = peta.get(potong.slice(0, i).join("."));
    if (nama) bagian.push(nama);
  }
  return bagian.join(", ");
}
