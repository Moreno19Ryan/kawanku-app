"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };

/** Client + admin bila memegang pengaturan.kelola (RLS tetap pembatasnya). */
async function konteks() {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || !punyaIzin(admin, "pengaturan.kelola")) return null;
  return { supabase, admin };
}

type IsiKategori = {
  nama: string;
  usia_min: number | null;
  usia_max: number | null;
  status_sekolah_berlaku: string[] | null;
  status_pernikahan_berlaku: string[] | null;
  termasuk_generus: boolean;
};

function bacaUsia(nilai: FormDataEntryValue | null): number | null | undefined {
  const teks = String(nilai ?? "").trim();
  if (!teks) return null;
  const angka = Number(teks);
  if (!Number.isInteger(angka) || angka < 0 || angka > 150) return undefined;
  return angka;
}

/** Validasi isian form kategori. Hasil string = pesan galat. */
function bacaIsian(formData: FormData): IsiKategori | string {
  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return "Isi nama kategori.";
  if (nama.length > 80) return "Nama maksimal 80 karakter.";

  const usiaMin = bacaUsia(formData.get("usia_min"));
  const usiaMax = bacaUsia(formData.get("usia_max"));
  if (usiaMin === undefined || usiaMax === undefined) return "Usia harus angka bulat 0–150.";
  if (usiaMin !== null && usiaMax !== null && usiaMax < usiaMin) {
    return "Usia maksimal tidak boleh lebih kecil dari usia minimal.";
  }

  const sekolah = formData.getAll("sekolah").map(String).filter((s) => s in LABEL_STATUS_SEKOLAH);
  const pernikahan = formData
    .getAll("pernikahan")
    .map(String)
    .filter((s) => s in LABEL_STATUS_PERNIKAHAN);

  if (usiaMin === null && usiaMax === null && sekolah.length === 0 && pernikahan.length === 0) {
    return "Isi minimal satu syarat (status sekolah, status pernikahan, atau usia).";
  }

  return {
    nama,
    usia_min: usiaMin,
    usia_max: usiaMax,
    status_sekolah_berlaku: sekolah.length ? sekolah : null,
    status_pernikahan_berlaku: pernikahan.length ? pernikahan : null,
    termasuk_generus: formData.get("generus") === "on",
  };
}

/** Kode tetap dari nama (mis. "Remaja Muda" → remaja_muda), unik. */
function buatKode(nama: string, terpakai: string[]): string {
  const dasar =
    nama
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "kategori";
  let kode = dasar;
  for (let i = 2; terpakai.includes(kode); i++) kode = `${dasar}_${i}`;
  return kode;
}

export async function simpanKategori(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const isi = bacaIsian(formData);
  if (typeof isi === "string") return { galat: isi };

  const { data, error } = await ctx.supabase
    .from("kategori_jamaah")
    .update(isi)
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Tersimpan." };
}

export async function tambahKategori(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const isi = bacaIsian(formData);
  if (typeof isi === "string") return { galat: isi };

  const { data: ada, error: galatBaca } = await ctx.supabase
    .from("kategori_jamaah")
    .select("kode, urutan");
  if (galatBaca) return GAGAL;

  // Kategori baru masuk paling bawah (dicek terakhir); urutan bisa diubah.
  const urutan = Math.max(0, ...ada.map((k) => k.urutan)) + 1;
  const kode = buatKode(isi.nama, ada.map((k) => k.kode));

  const { error } = await ctx.supabase.from("kategori_jamaah").insert({ ...isi, kode, urutan });
  if (error) return GAGAL;

  refresh();
  return { pesan: `Kategori “${isi.nama}” ditambahkan.` };
}

/**
 * Tukar urutan dengan kategori di atas/bawahnya. `urutan` unik, jadi lewat
 * nilai sementara (negatif) dulu.
 */
export async function pindahKategori(id: string, arah: "naik" | "turun"): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const { data: semua, error } = await ctx.supabase
    .from("kategori_jamaah")
    .select("id, urutan")
    .order("urutan");
  if (error) return GAGAL;

  const i = semua.findIndex((k) => k.id === id);
  const j = arah === "naik" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= semua.length) return {};
  const a = semua[i];
  const b = semua[j];

  const ubah = (kategoriId: string, urutan: number) =>
    ctx.supabase.from("kategori_jamaah").update({ urutan }).eq("id", kategoriId).select("id");

  const r1 = await ubah(a.id, -a.urutan);
  if (r1.error || r1.data.length === 0) return GAGAL;
  const r2 = await ubah(b.id, a.urutan);
  if (r2.error || r2.data.length === 0) {
    await ubah(a.id, a.urutan);
    return GAGAL;
  }
  const r3 = await ubah(a.id, b.urutan);
  if (r3.error || r3.data.length === 0) {
    await ubah(b.id, b.urutan);
    await ubah(a.id, a.urutan);
    return GAGAL;
  }

  refresh();
  return { pesan: "Urutan diubah." };
}

export async function hapusKategori(id: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const { data, error } = await ctx.supabase
    .from("kategori_jamaah")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Kategori dihapus." };
}
