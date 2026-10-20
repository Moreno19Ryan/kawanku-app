"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";

export type StateAksi = {
  galat?: string;
  pesan?: string;
};

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };

/**
 * Client Supabase + admin yang login, bila memegang izin global `izin`.
 * Pemeriksaan ini hanya untuk pesan yang jelas; RLS tetap pembatasnya.
 */
async function konteks(izin?: string) {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || (izin && !punyaIzin(admin, izin))) return null;
  return { supabase, admin };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Jumlah admin aktif yang tetap bisa mengelola akses (izin global
 * akses.kelola) seandainya perubahan dijalankan. Dipakai supaya akses desa
 * tidak terkunci: admin pengelola terakhir tidak bisa dinonaktifkan atau
 * dicabut perannya.
 */
async function sisaPengelolaAkses(
  supabase: Supabase,
  kecuali: { userId?: string; penugasanId?: string },
): Promise<number | null> {
  const { data, error } = await supabase
    .from("penugasan_peran")
    .select(
      "id, user_id, admin!inner(aktif), peran!inner(hanya_generus, peran_izin!inner(izin_kode))",
    )
    .is("kelompok_id", null)
    .eq("admin.aktif", true)
    .eq("peran.hanya_generus", false)
    .eq("peran.peran_izin.izin_kode", "akses.kelola");

  if (error) return null;

  const pengelola = new Set(
    data
      .filter((p) => p.id !== kecuali.penugasanId && p.user_id !== kecuali.userId)
      .map((p) => p.user_id),
  );
  return pengelola.size;
}

// ---------------------------------------------------------------------
// Akun saya
// ---------------------------------------------------------------------

export async function gantiKataSandi(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;

  const lama = String(formData.get("sandi_lama") ?? "");
  const baru = String(formData.get("sandi_baru") ?? "");
  const ulang = String(formData.get("sandi_ulang") ?? "");

  if (!lama || !baru) return { galat: "Isi kata sandi lama dan baru." };
  if (baru.length < 8) return { galat: "Kata sandi baru minimal 8 karakter." };
  if (baru !== ulang) return { galat: "Ulangi kata sandi baru dengan benar." };
  if (baru === lama) return { galat: "Kata sandi baru harus berbeda dari yang lama." };
  if (!ctx.admin.email) return GAGAL;

  // Pastikan yang mengganti benar pemilik akun (sesi bisa saja tertinggal
  // terbuka di perangkat lain).
  const { error: galatLama } = await ctx.supabase.auth.signInWithPassword({
    email: ctx.admin.email,
    password: lama,
  });
  if (galatLama) {
    return galatLama.status === 429
      ? { galat: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." }
      : { galat: "Kata sandi lama salah." };
  }

  const { error } = await ctx.supabase.auth.updateUser({ password: baru });
  if (error) {
    return error.code === "weak_password"
      ? { galat: "Kata sandi baru terlalu lemah. Pakai kombinasi huruf dan angka." }
      : GAGAL;
  }
  return { pesan: "Kata sandi berhasil diganti." };
}

// ---------------------------------------------------------------------
// Admin & akses (izin akses.kelola)
// ---------------------------------------------------------------------

export async function ubahStatusAdmin(
  userId: string,
  aktif: boolean,
): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;

  if (!aktif) {
    if (userId === ctx.admin.userId) {
      return { galat: "Kamu tidak bisa menonaktifkan akunmu sendiri." };
    }
    const sisa = await sisaPengelolaAkses(ctx.supabase, { userId });
    if (sisa === null) return GAGAL;
    if (sisa === 0) {
      return { galat: "Ini admin terakhir yang bisa mengelola akses. Tambah admin desa lain dulu." };
    }
  }

  const { data, error } = await ctx.supabase
    .from("admin")
    .update({ aktif })
    .eq("user_id", userId)
    .select("user_id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: aktif ? "Admin diaktifkan." : "Admin dinonaktifkan." };
}

export async function tambahPenugasan(
  userId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const peranId = String(formData.get("peran_id") ?? "");
  const kelompokId = String(formData.get("kelompok_id") ?? "") || null;
  if (!peranId) return { galat: "Pilih peran." };

  const { data: peran } = await ctx.supabase
    .from("peran")
    .select("wilayah")
    .eq("id", peranId)
    .maybeSingle<{ wilayah: "desa" | "kelompok" | "fleksibel" }>();
  if (!peran) return { galat: "Peran tidak ditemukan." };

  // desa = tanpa kelompok; kelompok = wajib kelompok; fleksibel = boleh keduanya.
  const kelompok = peran.wilayah === "desa" ? null : kelompokId;
  if (peran.wilayah === "kelompok" && !kelompok) {
    return { galat: "Peran ini wajib memilih kelompok." };
  }

  const { error } = await ctx.supabase
    .from("penugasan_peran")
    .insert({ user_id: userId, peran_id: peranId, kelompok_id: kelompok });
  if (error) {
    return error.code === "23505" ? { galat: "Penugasan ini sudah ada." } : GAGAL;
  }

  refresh();
  return { pesan: "Peran ditambahkan." };
}

export async function hapusPenugasan(
  penugasanId: string,
): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const sisa = await sisaPengelolaAkses(ctx.supabase, { penugasanId });
  if (sisa === null) return GAGAL;
  if (sisa === 0) {
    return { galat: "Ini peran terakhir yang bisa mengelola akses. Tambah admin desa lain dulu." };
  }

  const { data, error } = await ctx.supabase
    .from("penugasan_peran")
    .delete()
    .eq("id", penugasanId)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Peran dicabut." };
}

// ---------------------------------------------------------------------
// Kelompok (izin kelompok.kelola)
// ---------------------------------------------------------------------

export async function ubahNamaKelompok(
  kelompokId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks("kelompok.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return { galat: "Nama kelompok wajib diisi." };
  if (nama.length > 60) return { galat: "Nama kelompok maksimal 60 karakter." };

  const { data, error } = await ctx.supabase
    .from("kelompok")
    .update({ nama })
    .eq("id", kelompokId)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Tersimpan." };
}

export async function ubahStatusKelompok(
  kelompokId: string,
  aktif: boolean,
): Promise<StateAksi> {
  const ctx = await konteks("kelompok.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const { data, error } = await ctx.supabase
    .from("kelompok")
    .update({ aktif })
    .eq("id", kelompokId)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: aktif ? "Kelompok diaktifkan." : "Kelompok dinonaktifkan." };
}
