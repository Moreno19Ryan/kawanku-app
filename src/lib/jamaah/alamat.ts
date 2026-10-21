import { adaWilayah, namaLengkapWilayah } from "@/lib/wilayah";

export type Alamat = {
  kode_wilayah: string | null;
  wilayah: string | null;
  jalan: string | null;
  rt: number | null;
  rw: number | null;
  kode_pos: string | null;
};

/** Baca & validasi isian alamat (awalan ktp_/dom_) dari form; string = pesan galat. */
export function bacaAlamat(formData: FormData, awalan: "ktp" | "dom"): Alamat | string {
  const ambil = (n: string) => String(formData.get(`${awalan}_${n}`) ?? "").trim();
  const dokumen = formData.get("dokumen") === "KIA" ? "KIA" : "KTP";
  const nama = awalan === "ktp" ? `alamat ${dokumen}` : "alamat domisili";
  const kode = ambil("kode_wilayah");
  if (kode && !adaWilayah(kode)) return `Wilayah ${nama} tidak dikenal.`;
  const jalan = ambil("jalan").replace(/\s+/g, " ");
  if (jalan.length > 200) return `Jalan/perumahan ${nama} maksimal 200 karakter.`;
  const angka = (n: string): number | null | undefined => {
    const t = ambil(n);
    if (!t) return null;
    const v = Number(t);
    return Number.isInteger(v) && v >= 0 && v <= 999 ? v : undefined;
  };
  const rt = angka("rt");
  const rw = angka("rw");
  if (rt === undefined || rw === undefined) return `RT/RW ${nama} harus angka 0–999.`;
  const kodePos = ambil("kode_pos");
  if (kodePos && !/^\d{5}$/.test(kodePos)) return `Kode pos ${nama} harus 5 angka.`;
  return {
    kode_wilayah: kode || null,
    wilayah: kode ? namaLengkapWilayah(kode) : null,
    jalan: jalan || null,
    rt,
    rw,
    kode_pos: kodePos || null,
  };
}
