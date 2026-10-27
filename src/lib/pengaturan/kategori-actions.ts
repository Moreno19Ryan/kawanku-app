"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import { masalahAturan, urutanSistem, type AturanKategori } from "@/lib/jamaah/kategori";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

const TIDAK_BERHAK: StateAksi = { galat: "Mohon maaf, tindakan ini di luar wewenang akun ini." };
const GAGAL: StateAksi = { galat: "Mohon maaf, belum berhasil disimpan. Silakan coba lagi." };

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

  // Generus selalu khusus lajang (dijaga database: kategori_jamaah_generus_lajang).
  const generus = formData.get("generus") === "on";
  return {
    nama,
    usia_min: usiaMin,
    usia_max: usiaMax,
    status_sekolah_berlaku: sekolah.length ? sekolah : null,
    status_pernikahan_berlaku: generus ? ["lajang"] : pernikahan.length ? pernikahan : null,
    termasuk_generus: generus,
  };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof konteks>>>;

async function bacaSemua(ctx: Ctx) {
  return ctx.supabase
    .from("kategori_jamaah")
    .select(
      "id, kode, nama, urutan, usia_min, usia_max, status_sekolah_berlaku, status_pernikahan_berlaku, termasuk_generus",
    )
    .returns<(AturanKategori & { kode: string })[]>();
}

/** Tolak aturan yang membuat kategori tak terpakai / generus memuat yang menikah. */
function tolakBilaBermasalah(aturan: AturanKategori[]): StateAksi | null {
  const masalah = masalahAturan(aturan);
  if (!masalah.length) return null;
  return { galat: `Tidak disimpan. ${masalah.join(" ")} Ubah syaratnya supaya setiap kategori punya jamaahnya sendiri.` };
}

/** Tulis urutan pemeriksaan yang diatur sistem (satu transaksi, lewat RLS). */
async function aturUrutan(ctx: Ctx): Promise<boolean> {
  const { data, error } = await bacaSemua(ctx);
  if (error) return false;
  const { error: galat } = await ctx.supabase.rpc("atur_urutan_kategori", {
    p_ids: urutanSistem(data).map((k) => k.id),
  });
  return !galat;
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

  const { data: semua, error: galatBaca } = await bacaSemua(ctx);
  if (galatBaca) return GAGAL;
  const tolak = tolakBilaBermasalah(semua.map((k) => (k.id === id ? { ...k, ...isi } : k)));
  if (tolak) return tolak;

  const { data, error } = await ctx.supabase
    .from("kategori_jamaah")
    .update(isi)
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return GAGAL;
  const urutanOk = await aturUrutan(ctx);

  refresh();
  return urutanOk
    ? { pesan: "Tersimpan. Urutan pemeriksaan disesuaikan otomatis." }
    : { galat: "Aturan tersimpan, tapi urutan gagal disesuaikan. Simpan sekali lagi." };
}

export async function tambahKategori(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const isi = bacaIsian(formData);
  if (typeof isi === "string") return { galat: isi };

  const { data: ada, error: galatBaca } = await bacaSemua(ctx);
  if (galatBaca) return GAGAL;
  const tolak = tolakBilaBermasalah([...ada, { ...isi, id: "baru", urutan: 0 }]);
  if (tolak) return tolak;

  // Ditaruh paling bawah dulu, lalu urutan diatur ulang oleh sistem.
  const urutan = Math.max(0, ...ada.map((k) => k.urutan)) + 1;
  const kode = buatKode(isi.nama, ada.map((k) => k.kode));

  const { error } = await ctx.supabase.from("kategori_jamaah").insert({ ...isi, kode, urutan });
  if (error) return GAGAL;
  await aturUrutan(ctx);

  refresh();
  return { pesan: `Kategori “${isi.nama}” ditambahkan.` };
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
