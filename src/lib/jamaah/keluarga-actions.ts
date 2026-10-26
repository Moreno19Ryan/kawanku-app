"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { LABEL_HUBUNGAN } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };

/** Konteks pengelola keluarga (keluarga.kelola di kelompok yang menyala). */
async function konteks() {
  const akses = await getAksesJamaah();
  if (!akses || akses.kelompokKeluargaKelola.length === 0) return null;
  return { akses, supabase: await createClient() };
}

function bacaNama(formData: FormData): string | { galat: string } {
  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return { galat: "Isi nama keluarga." };
  if (nama.length > 120) return { galat: "Nama keluarga maksimal 120 karakter." };
  return nama;
}

function bacaHubungan(formData: FormData): string | null {
  const h = String(formData.get("hubungan") ?? "");
  return h in LABEL_HUBUNGAN ? h : null;
}

export async function buatKeluarga(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const nama = bacaNama(formData);
  if (typeof nama !== "string") return nama;
  const kelompok = String(formData.get("kelompok_id") ?? "");
  if (!ctx.akses.kelompokKeluargaKelola.some((k) => k.id === kelompok)) return { galat: "Pilih kelompok." };

  const { data, error } = await ctx.supabase
    .from("keluarga")
    .insert({ nama, kelompok_id: kelompok })
    .select("id")
    .maybeSingle();
  if (error || !data) return GAGAL;
  redirect(`/jamaah/keluarga/${data.id}`);
}

/** Buat keluarga baru dengan jamaah ini sebagai kepala keluarga. */
export async function buatKeluargaDariJamaah(jamaahId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data: j } = await ctx.supabase
    .from("jamaah")
    .select("nama_lengkap, kelompok_id, keluarga_id")
    .eq("id", jamaahId)
    .maybeSingle();
  if (!j) return TIDAK_BERHAK;
  if (j.keluarga_id) return { galat: "Jamaah ini sudah punya keluarga." };
  if (!ctx.akses.kelompokKeluargaKelola.some((k) => k.id === j.kelompok_id)) return TIDAK_BERHAK;

  const { data: kel, error } = await ctx.supabase
    .from("keluarga")
    .insert({ nama: `Keluarga ${j.nama_lengkap}`.slice(0, 120), kelompok_id: j.kelompok_id })
    .select("id")
    .maybeSingle();
  if (error || !kel) return GAGAL;
  const { data: ok } = await ctx.supabase
    .from("jamaah")
    .update({ keluarga_id: kel.id, hubungan_keluarga: "kepala_keluarga" })
    .eq("id", jamaahId)
    .select("id");
  if (!ok?.length) {
    await ctx.supabase.from("keluarga").delete().eq("id", kel.id);
    return { galat: "Gagal menjadikan kepala keluarga (di luar wewenangmu?)." };
  }
  redirect(`/jamaah/keluarga/${kel.id}`);
}

export async function ubahNamaKeluarga(
  id: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const nama = bacaNama(formData);
  if (typeof nama !== "string") return nama;
  const { data, error } = await ctx.supabase.from("keluarga").update({ nama }).eq("id", id).select("id");
  if (error || data.length === 0) return GAGAL;
  refresh();
  return { pesan: "Tersimpan." };
}

/**
 * Hapus keluarga ke tempat sampah (30 hari); anggotanya tetap ada, dilepas
 * dari keluarga ini oleh database dan dipasang lagi bila dikembalikan.
 */
export async function hapusKeluarga(id: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase.from("keluarga").delete().eq("id", id).select("id");
  if (error || data.length === 0) return GAGAL;
  redirect("/jamaah/keluarga");
}

/** Masukkan jamaah ke keluarga (keluarga & jamaah harus satu kelompok). */
export async function tambahAnggota(
  keluargaId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const jamaahId = String(formData.get("jamaah_id") ?? "");
  const hubungan = bacaHubungan(formData);
  if (!jamaahId) return { galat: "Pilih jamaah." };
  if (!hubungan) return { galat: "Pilih hubungan dalam keluarga." };

  const { data, error } = await ctx.supabase
    .from("jamaah")
    .update({ keluarga_id: keluargaId, hubungan_keluarga: hubungan })
    .eq("id", jamaahId)
    .is("keluarga_id", null)
    .select("id");
  if (error) return { galat: "Gagal: jamaah dan keluarga harus di kelompok yang sama." };
  if (data.length === 0) return { galat: "Jamaah ini sudah punya keluarga atau di luar wewenangmu." };
  refresh();
  return { pesan: "Anggota ditambahkan." };
}

/** Hubungkan jamaah (dari halaman detailnya) ke keluarga yang sudah ada. */
export async function hubungkanKeKeluarga(
  jamaahId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const keluargaId = String(formData.get("keluarga_id") ?? "");
  if (!keluargaId) return { galat: "Pilih keluarga." };
  const data = new FormData();
  data.set("jamaah_id", jamaahId);
  data.set("hubungan", String(formData.get("hubungan") ?? ""));
  return tambahAnggota(keluargaId, {}, data);
}

export async function ubahHubungan(
  jamaahId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const hubungan = bacaHubungan(formData);
  if (!hubungan) return { galat: "Pilih hubungan." };
  const { data, error } = await ctx.supabase
    .from("jamaah")
    .update({ hubungan_keluarga: hubungan })
    .eq("id", jamaahId)
    .not("keluarga_id", "is", null)
    .select("id");
  if (error || data.length === 0) return GAGAL;
  refresh();
  return { pesan: "Tersimpan." };
}

export async function lepasAnggota(jamaahId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase
    .from("jamaah")
    .update({ keluarga_id: null, hubungan_keluarga: null })
    .eq("id", jamaahId)
    .select("id");
  if (error || data.length === 0) return GAGAL;
  refresh();
  return { pesan: "Dilepas dari keluarga." };
}
