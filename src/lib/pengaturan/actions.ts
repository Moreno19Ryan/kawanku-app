"use server";

import { randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";

export type StateAksi = {
  galat?: string;
  pesan?: string;
  /** Kata sandi sementara, ditampilkan SEKALI ke admin pembuat. */
  sandiSementara?: string;
  /** Email akun yang baru dibuat (untuk kotak kata sandi sementara). */
  email?: string;
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

/**
 * Peran + wilayah dari form (peran_id, kelompok_id). Wilayah peran:
 * desa = tanpa kelompok; kelompok = wajib kelompok; fleksibel = boleh keduanya.
 */
async function bacaPeranWilayah(
  supabase: Supabase,
  formData: FormData,
): Promise<{ peran_id: string; kelompok_id: string | null } | { galat: string }> {
  const peranId = String(formData.get("peran_id") ?? "");
  const kelompokId = String(formData.get("kelompok_id") ?? "") || null;
  if (!peranId) return { galat: "Pilih peran." };

  const { data: peran } = await supabase
    .from("peran")
    .select("wilayah")
    .eq("id", peranId)
    .maybeSingle<{ wilayah: "desa" | "kelompok" | "fleksibel" }>();
  if (!peran) return { galat: "Peran tidak ditemukan." };

  const kelompok = peran.wilayah === "desa" ? null : kelompokId;
  if (peran.wilayah === "kelompok" && !kelompok) {
    return { galat: "Peran ini wajib memilih kelompok." };
  }
  return { peran_id: peranId, kelompok_id: kelompok };
}

/** Kata sandi sementara acak, mudah dibacakan: xxxx-xxxx-xxxx (tanpa 0/O/1/l). */
function buatSandiSementara() {
  const huruf = "abcdefghjkmnpqrstuvwxyz23456789";
  const blok = () => Array.from({ length: 4 }, () => huruf[randomInt(huruf.length)]).join("");
  return `${blok()}-${blok()}-${blok()}`;
}

const TANPA_SECRET: StateAksi = {
  galat: "Fitur ini belum aktif: SUPABASE_SECRET_KEY belum dipasang di server.",
};

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

export async function ubahNamaAdmin(
  userId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return { galat: "Nama wajib diisi." };
  if (nama.length > 80) return { galat: "Nama maksimal 80 karakter." };

  const { data, error } = await ctx.supabase
    .from("admin")
    .update({ nama })
    .eq("user_id", userId)
    .select("user_id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Nama tersimpan." };
}

export async function tambahPenugasan(
  userId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const tujuan = await bacaPeranWilayah(ctx.supabase, formData);
  if ("galat" in tujuan) return tujuan;

  const { error } = await ctx.supabase
    .from("penugasan_peran")
    .insert({ user_id: userId, ...tujuan });
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

// ---------------------------------------------------------------------
// Akun admin baru & atur ulang kata sandi (akses.kelola + secret key)
// ---------------------------------------------------------------------

/**
 * Membuat akun login (Supabase Auth, lewat secret key) lalu profil admin dan
 * penugasan perannya (lewat sesi pengguna, jadi tetap dijaga RLS). Bila
 * langkah kedua gagal, akun Auth dihapus lagi supaya tidak tertinggal.
 */
export async function buatAdmin(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;
  const adminAuth = createAdminClient();
  if (!adminAuth) return TANPA_SECRET;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { galat: "Email tidak valid." };
  if (!nama) return { galat: "Nama wajib diisi." };
  if (nama.length > 80) return { galat: "Nama maksimal 80 karakter." };

  const tujuan = await bacaPeranWilayah(ctx.supabase, formData);
  if ("galat" in tujuan) return tujuan;

  const sandiSementara = buatSandiSementara();
  const { data: dibuat, error: galatAuth } = await adminAuth.auth.admin.createUser({
    email,
    password: sandiSementara,
    email_confirm: true,
  });
  if (galatAuth || !dibuat.user) {
    return galatAuth?.code === "email_exists"
      ? { galat: "Email ini sudah terdaftar. Pakai email lain." }
      : GAGAL;
  }

  const userId = dibuat.user.id;
  const { error: galatProfil } = await ctx.supabase.from("admin").insert({ user_id: userId, nama });
  const { error: galatPeran } = galatProfil
    ? { error: galatProfil }
    : await ctx.supabase.from("penugasan_peran").insert({ user_id: userId, ...tujuan });

  if (galatProfil || galatPeran) {
    // Profil & penugasan ikut terhapus (on delete cascade dari auth.users).
    await adminAuth.auth.admin.deleteUser(userId);
    return GAGAL;
  }

  refresh();
  return { pesan: `Akun ${email} dibuat.`, sandiSementara, email };
}

/** Mengganti kata sandi admin lain dengan kata sandi sementara baru. */
export async function aturUlangKataSandi(userId: string): Promise<StateAksi> {
  const ctx = await konteks("akses.kelola");
  if (!ctx) return TIDAK_BERHAK;
  if (userId === ctx.admin.userId) {
    return { galat: "Untuk akunmu sendiri, pakai Pengaturan → Akun saya." };
  }
  const adminAuth = createAdminClient();
  if (!adminAuth) return TANPA_SECRET;

  // Pastikan targetnya memang admin yang terlihat oleh pemanggil (lewat RLS),
  // bukan akun lain (mis. akun generus nanti).
  const { data: target } = await ctx.supabase
    .from("admin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return GAGAL;

  const sandiSementara = buatSandiSementara();
  const { error } = await adminAuth.auth.admin.updateUserById(userId, { password: sandiSementara });
  if (error) return GAGAL;

  return { pesan: "Kata sandi sementara dibuat.", sandiSementara };
}
