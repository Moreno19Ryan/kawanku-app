"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import {
  LABEL_PENDIDIKAN,
  LABEL_STATUS_PERNIKAHAN,
  LABEL_STATUS_SEKOLAH,
  PAKET_CABERAWIT,
} from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";
import { adaWilayah, namaLengkapWilayah } from "@/lib/wilayah";

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };
const DI_LUAR_WEWENANG: StateAksi = {
  galat:
    "Tidak bisa disimpan: jamaah ini (atau isian barunya) di luar wewenangmu. Admin generus hanya bisa menyimpan jamaah yang tetap berkategori generus.",
};

type IsiJamaah = {
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: "L" | "P";
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  status_pernikahan: string;
  status_sekolah: string;
  kelompok_id: string;
  tempat_lahir: string | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  muballigh: boolean;
  jenis_muballigh: string | null;
  paket_caberawit: string | null;
};

/** "YYYY-MM-DD" hari ini di WIB. */
function hariIniWib(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** Validasi isian form jamaah. Hasil string = pesan galat. */
function bacaIsian(formData: FormData): IsiJamaah | string {
  const teks = (nama: string) => String(formData.get(nama) ?? "").trim().replace(/\s+/g, " ");

  const nama = teks("nama_lengkap");
  if (!nama) return "Isi nama lengkap.";
  if (nama.length > 120) return "Nama lengkap maksimal 120 karakter.";
  const panggilan = teks("nama_panggilan");
  if (panggilan.length > 40) return "Nama panggilan maksimal 40 karakter.";

  const jk = teks("jenis_kelamin");
  if (jk !== "L" && jk !== "P") return "Pilih jenis kelamin.";

  const tanggal = teks("tanggal_lahir");
  const tahunTeks = teks("tahun_lahir");
  let tahun: number | null = null;
  if (tanggal) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(Date.parse(tanggal))) {
      return "Tanggal lahir tidak valid.";
    }
    if (tanggal <= "1900-01-01" || tanggal > hariIniWib()) return "Tanggal lahir tidak masuk akal.";
    tahun = Number(tanggal.slice(0, 4));
  } else if (tahunTeks) {
    tahun = Number(tahunTeks);
    const tahunIni = Number(hariIniWib().slice(0, 4));
    if (!Number.isInteger(tahun) || tahun <= 1900 || tahun > tahunIni) {
      return `Tahun lahir harus antara 1901 dan ${tahunIni}.`;
    }
  } else {
    return "Isi tanggal lahir, atau minimal tahun lahir.";
  }

  const pernikahan = teks("status_pernikahan");
  if (!(pernikahan in LABEL_STATUS_PERNIKAHAN)) return "Pilih status pernikahan.";
  const sekolah = teks("status_sekolah");
  if (!(sekolah in LABEL_STATUS_SEKOLAH)) return "Pilih status sekolah/kegiatan.";

  const tempatLahir = teks("tempat_lahir");
  if (tempatLahir.length > 80) return "Tempat lahir maksimal 80 karakter.";
  const pendidikan = teks("pendidikan_terakhir");
  if (pendidikan && !(pendidikan in LABEL_PENDIDIKAN)) return "Pendidikan terakhir tidak valid.";
  const kegiatan = teks("kegiatan");
  if (kegiatan.length > 120) return "Pekerjaan/kegiatan maksimal 120 karakter.";
  const muballigh = formData.get("muballigh") === "on";
  const jenisMuballigh = teks("jenis_muballigh");
  if (jenisMuballigh && jenisMuballigh !== "tugasan" && jenisMuballigh !== "setempat") {
    return "Pilihan MT/MS tidak valid.";
  }
  const paket = teks("paket_caberawit");
  if (paket && !(PAKET_CABERAWIT as readonly string[]).includes(paket)) return "Paket caberawit tidak valid.";

  const kelompok = teks("kelompok_id");
  if (!kelompok) return "Pilih kelompok.";

  return {
    nama_lengkap: nama,
    nama_panggilan: panggilan || null,
    jenis_kelamin: jk,
    tanggal_lahir: tanggal || null,
    tahun_lahir: tahun,
    status_pernikahan: pernikahan,
    status_sekolah: sekolah,
    kelompok_id: kelompok,
    tempat_lahir: tempatLahir || null,
    pendidikan_terakhir: pendidikan || null,
    kegiatan: kegiatan || null,
    muballigh,
    // MT/MS hanya bila berstatus muballigh/muballighot (dijaga juga di database).
    jenis_muballigh: muballigh && jenisMuballigh ? jenisMuballigh : null,
    paket_caberawit: paket || null,
  };
}

export async function tambahJamaah(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokTambah.length === 0) return TIDAK_BERHAK;

  const isi = bacaIsian(formData);
  if (typeof isi === "string") return { galat: isi };
  if (!akses.kelompokTambah.some((k) => k.id === isi.kelompok_id)) {
    return { galat: "Kamu tidak bisa menambah jamaah di kelompok itu." };
  }

  const supabase = await createClient();
  // Kode KW-XXXXXX dibuat trigger database.
  const { data, error } = await supabase.from("jamaah").insert(isi).select("id").maybeSingle();
  if (error || !data) return error?.code === "42501" ? DI_LUAR_WEWENANG : GAGAL;

  redirect(`/jamaah/${data.id}?baru=1`);
}

export async function ubahJamaah(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokUbah.length === 0) return TIDAK_BERHAK;

  const isi = bacaIsian(formData);
  if (typeof isi === "string") return { galat: isi };
  if (!akses.kelompokUbah.some((k) => k.id === isi.kelompok_id)) {
    return { galat: "Kamu tidak bisa memindahkan jamaah ke kelompok itu." };
  }

  const supabase = await createClient();
  // Keluarga harus satu kelompok dengan anggotanya (FK komposit): pindah
  // kelompok = lepas dari keluarga lama.
  const { data: lama } = await supabase
    .from("jamaah")
    .select("kelompok_id, keluarga_id")
    .eq("id", id)
    .maybeSingle();
  const lepasKeluarga = Boolean(lama?.keluarga_id && lama.kelompok_id !== isi.kelompok_id);
  const ubah = lepasKeluarga ? { ...isi, keluarga_id: null, hubungan_keluarga: null } : isi;

  const { data, error } = await supabase.from("jamaah").update(ubah).eq("id", id).select("id");
  if (error) return error.code === "42501" ? DI_LUAR_WEWENANG : GAGAL;
  if (data.length === 0) return DI_LUAR_WEWENANG;

  refresh();
  return {
    pesan: lepasKeluarga
      ? "Tersimpan. Karena pindah kelompok, jamaah dilepas dari keluarganya yang lama."
      : "Tersimpan.",
  };
}

export async function ubahStatusJamaah(id: string, aktif: boolean): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokUbah.length === 0) return TIDAK_BERHAK;

  const supabase = await createClient();
  const { data, error } = await supabase.from("jamaah").update({ aktif }).eq("id", id).select("id");
  if (error || data.length === 0) return DI_LUAR_WEWENANG;

  refresh();
  return { pesan: aktif ? "Jamaah diaktifkan kembali." : "Jamaah dinonaktifkan." };
}

export async function hapusJamaah(id: string): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehHapus) return TIDAK_BERHAK;

  const supabase = await createClient();
  const { data, error } = await supabase.from("jamaah").delete().eq("id", id).select("id");
  if (error || data.length === 0) return DI_LUAR_WEWENANG;

  redirect("/jamaah");
}

/** Penanda jalur keringanan (absensi dengan kartu fisik, tanpa HP). */
export async function aturKeringanan(id: string, aktif: boolean): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehKelolaKeringanan) return TIDAK_BERHAK;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jamaah_keringanan")
    .upsert({ jamaah_id: id, jenis: "tanpa_hp", aktif })
    .select("jamaah_id");
  if (error || data.length === 0) return DI_LUAR_WEWENANG;

  refresh();
  return { pesan: aktif ? "Ditandai jalur keringanan." : "Penanda keringanan dicabut." };
}

/** Keterangan janda/duda (izin janda_duda.kelola). Kosong = belum diketahui. */
export async function aturJandaDuda(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehKelolaJandaDuda) return TIDAK_BERHAK;

  const jenis = String(formData.get("jenis") ?? "");
  const supabase = await createClient();

  if (!jenis) {
    const { error } = await supabase.from("jamaah_janda_duda").delete().eq("jamaah_id", id);
    if (error) return GAGAL;
  } else {
    if (jenis !== "cerai_hidup" && jenis !== "cerai_mati") return { galat: "Pilihan tidak valid." };
    const { data, error } = await supabase
      .from("jamaah_janda_duda")
      .upsert({ jamaah_id: id, jenis })
      .select("jamaah_id");
    if (error || data.length === 0) return GAGAL;
  }

  refresh();
  return { pesan: "Tersimpan." };
}

// ---------------------------------------------------------------------
// Data sensitif (tabel terpisah, izin sendiri; batas sebenarnya RLS)
// ---------------------------------------------------------------------

/** "0812-3456-7890", "+62 812…", "62812…" → "081234567890". Null bila kosong. */
function bacaNoHp(nilai: FormDataEntryValue | null): string | null | undefined {
  const angka = String(nilai ?? "").replace(/[\s\-().]/g, "");
  if (!angka) return null;
  const normal = angka.replace(/^\+?62/, "0");
  return /^08\d{8,12}$/.test(normal) ? normal : undefined;
}

/** Simpan satu baris per jamaah: kosong semua → baris dihapus. */
async function simpanBaris(
  tabel: "jamaah_kontak" | "jamaah_pribadi" | "jamaah_identitas",
  jamaahId: string,
  isi: Record<string, string | number | boolean | null>,
): Promise<StateAksi> {
  const supabase = await createClient();
  const kosong = Object.entries(isi).every(([k, v]) => v === null || (k === "domisili_sama_ktp" && v === false));
  if (kosong) {
    const { error } = await supabase.from(tabel).delete().eq("jamaah_id", jamaahId);
    if (error) return GAGAL;
  } else {
    const { data, error } = await supabase
      .from(tabel)
      .upsert({ jamaah_id: jamaahId, ...isi })
      .select("jamaah_id");
    if (error) {
      if (error.code === "23505") return { galat: "NIK ini sudah dipakai jamaah lain." };
      return error.code === "42501" ? TIDAK_BERHAK : GAGAL;
    }
    if (data.length === 0) return TIDAK_BERHAK;
  }
  refresh();
  return { pesan: "Tersimpan." };
}

export async function simpanKontak(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehKelolaKontak) return TIDAK_BERHAK;

  const noHp = bacaNoHp(formData.get("no_hp"));
  const noHpWali = bacaNoHp(formData.get("no_hp_wali"));
  if (noHp === undefined || noHpWali === undefined) {
    return { galat: "No. HP harus nomor Indonesia yang valid, mis. 0812-3456-7890." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return { galat: "Format email tidak valid." };
  }
  return simpanBaris("jamaah_kontak", id, { no_hp: noHp, no_hp_wali: noHpWali, email: email || null });
}

type Alamat = {
  kode_wilayah: string | null;
  wilayah: string | null;
  jalan: string | null;
  rt: number | null;
  rw: number | null;
  kode_pos: string | null;
};

function bacaAlamat(formData: FormData, awalan: "ktp" | "dom"): Alamat | string {
  const ambil = (n: string) => String(formData.get(`${awalan}_${n}`) ?? "").trim();
  const nama = awalan === "ktp" ? "alamat KTP" : "alamat domisili";
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

export async function simpanPribadi(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehKelolaPribadi) return TIDAK_BERHAK;

  const nama = (n: string) => String(formData.get(n) ?? "").trim().replace(/\s+/g, " ");
  const ayah = nama("nama_ayah");
  const ibu = nama("nama_ibu");
  if (ayah.length > 120 || ibu.length > 120) return { galat: "Nama orang tua maksimal 120 karakter." };

  const ktp = bacaAlamat(formData, "ktp");
  if (typeof ktp === "string") return { galat: ktp };
  const sama = formData.get("domisili_sama_ktp") === "on";
  const dom = sama ? null : bacaAlamat(formData, "dom");
  if (typeof dom === "string") return { galat: dom };

  return simpanBaris("jamaah_pribadi", id, {
    nama_ayah: ayah || null,
    nama_ibu: ibu || null,
    ktp_kode_wilayah: ktp.kode_wilayah,
    ktp_wilayah: ktp.wilayah,
    ktp_jalan: ktp.jalan,
    ktp_rt: ktp.rt,
    ktp_rw: ktp.rw,
    ktp_kode_pos: ktp.kode_pos,
    domisili_sama_ktp: sama,
    dom_kode_wilayah: dom?.kode_wilayah ?? null,
    dom_wilayah: dom?.wilayah ?? null,
    dom_jalan: dom?.jalan ?? null,
    dom_rt: dom?.rt ?? null,
    dom_rw: dom?.rw ?? null,
    dom_kode_pos: dom?.kode_pos ?? null,
  });
}

export async function simpanIdentitas(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.bolehKelolaIdentitas) return TIDAK_BERHAK;

  const angka = (n: string) => String(formData.get(n) ?? "").replace(/\s/g, "");
  const nik = angka("nik");
  const kk = angka("no_kk");
  if ((nik && !/^\d{16}$/.test(nik)) || (kk && !/^\d{16}$/.test(kk))) {
    return { galat: "NIK dan No. KK masing-masing 16 angka." };
  }
  return simpanBaris("jamaah_identitas", id, { nik: nik || null, no_kk: kk || null });
}
