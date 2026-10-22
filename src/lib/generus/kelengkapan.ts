/**
 * Kelengkapan data diri generus (untuk ajakan melengkapi data di beranda &
 * profil). Fungsi murni. Yang dihitung hanya data yang semestinya dimiliki
 * setiap generus; email, pendidikan terakhir, dan pekerjaan tidak wajib.
 */
import { RENTANG_KELAS } from "@/lib/label";

export type DataKelengkapan = {
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  status_sekolah: string | null;
  kelas: number | null;
  no_hp: string | null;
  no_hp_wali: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  /** Ada isian alamat KTP/KIA (wilayah atau jalan). */
  ada_alamat: boolean;
};

export type Kelengkapan = {
  persen: number;
  /** Label isian yang belum diisi, urut seperti di form. */
  kurang: string[];
  /** Hanya alamat yang belum (diisi di halaman sendiri). */
  hanyaAlamat: boolean;
};

export function hitungKelengkapan(d: DataKelengkapan): Kelengkapan {
  const butir: [string, boolean][] = [
    ["tempat lahir", Boolean(d.tempat_lahir)],
    ["tanggal lahir", Boolean(d.tanggal_lahir)],
    ["status sekolah", Boolean(d.status_sekolah)],
    ...(d.status_sekolah && RENTANG_KELAS[d.status_sekolah] ? [["kelas", d.kelas !== null] as [string, boolean]] : []),
    ["no. HP", Boolean(d.no_hp)],
    ["nama ayah", Boolean(d.nama_ayah)],
    ["nama ibu", Boolean(d.nama_ibu)],
    ["no. HP orang tua/wali", Boolean(d.no_hp_wali)],
    ["alamat", d.ada_alamat],
  ];
  const kurang = butir.filter(([, ada]) => !ada).map(([label]) => label);
  return {
    persen: Math.round(((butir.length - kurang.length) / butir.length) * 100),
    kurang,
    hanyaAlamat: kurang.length === 1 && kurang[0] === "alamat",
  };
}
