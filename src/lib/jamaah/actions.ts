"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

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
  status_pernikahan: string | null;
  status_sekolah: string | null;
  kelompok_id: string;
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
  }

  const pernikahan = teks("status_pernikahan");
  if (pernikahan && !(pernikahan in LABEL_STATUS_PERNIKAHAN)) return "Status pernikahan tidak valid.";
  const sekolah = teks("status_sekolah");
  if (sekolah && !(sekolah in LABEL_STATUS_SEKOLAH)) return "Status sekolah tidak valid.";

  const kelompok = teks("kelompok_id");
  if (!kelompok) return "Pilih kelompok.";

  return {
    nama_lengkap: nama,
    nama_panggilan: panggilan || null,
    jenis_kelamin: jk,
    tanggal_lahir: tanggal || null,
    tahun_lahir: tahun,
    status_pernikahan: pernikahan || null,
    status_sekolah: sekolah || null,
    kelompok_id: kelompok,
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
  const { data, error } = await supabase.from("jamaah").update(isi).eq("id", id).select("id");
  if (error) return error.code === "42501" ? DI_LUAR_WEWENANG : GAGAL;
  if (data.length === 0) return DI_LUAR_WEWENANG;

  refresh();
  return { pesan: "Tersimpan." };
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
