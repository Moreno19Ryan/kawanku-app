"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { pinDariTanggalLahir } from "@/lib/generus/akun";
import { slugUsername, usulanUsername } from "@/lib/generus/username";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TIDAK_BERHAK: StateAksi = { galat: "Mohon maaf, tindakan ini di luar wewenang akun ini." };
const TANPA_KEY: StateAksi = {
  galat: "Fitur akun belum dikonfigurasi di server (SUPABASE_SECRET_KEY). Hubungi pengembang.",
};

type Jamaah = { id: string; kode: string; nama_lengkap: string; nama_panggilan: string | null; tanggal_lahir: string | null };

/**
 * Konteks pengelola akun generus untuk satu jamaah: izin dicek di database
 * (boleh_kelola_akun_generus) SEBELUM secret key dipakai.
 */
async function konteks(jamaahId: string) {
  const akses = await getAksesAbsensi();
  if (!akses || akses.kelompokAkun.length === 0) return null;
  const supabase = await createClient();
  const { data: boleh } = await supabase.rpc("boleh_kelola_akun_generus", { p_jamaah_id: jamaahId });
  if (!boleh) return null;
  const { data: jamaah } = await supabase
    .from("jamaah")
    .select("id, kode, nama_lengkap, nama_panggilan, tanggal_lahir")
    .eq("id", jamaahId)
    .maybeSingle<Jamaah>();
  if (!jamaah) return null;
  return { supabase, jamaah };
}

function bacaUsername(nilai: FormDataEntryValue | null): string | { galat: string } {
  const u = slugUsername(String(nilai ?? ""));
  if (u.length < 3) return { galat: "Username minimal 3 huruf/angka." };
  return u;
}

function bacaPin(j: Jamaah, nilai: FormDataEntryValue | null): string | { galat: string } {
  const isian = String(nilai ?? "").trim();
  if (isian) return /^\d{6}$/.test(isian) ? isian : { galat: "Mohon isi PIN 6 angka." };
  return (
    pinDariTanggalLahir(j.tanggal_lahir) ?? {
      galat: "Tanggal lahir belum lengkap, jadi PIN awal tidak bisa dibuat otomatis. Isi PIN 6 angka.",
    }
  );
}

/**
 * Buat user Auth + baris akun_generus. Username yang sudah dipakai dicoba
 * dengan akhiran angka (nadia, nadia2, …) bila `boleh_akhiran`.
 */
async function buat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  j: Jamaah,
  username: string,
  pin: string,
  bolehAkhiran: boolean,
): Promise<StateAksi & { username?: string }> {
  const adminAuth = createAdminClient();
  if (!adminAuth) return TANPA_KEY;

  const { data: dibuat, error: galatAuth } = await adminAuth.auth.admin.createUser({
    email: `${j.kode.toLowerCase()}@generus.kawanku.invalid`,
    // Kata sandi Auth acak; PIN disimpan terpisah (atur_pin_generus) dan
    // diperiksa server saat login.
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    app_metadata: { jenis: "generus" },
  });
  if (galatAuth || !dibuat.user) {
    return {
      galat: galatAuth?.code === "email_exists"
        ? "Akun login untuk jamaah ini sudah ada. Muat ulang halaman."
        : galatAuth?.code === "weak_password"
          ? "PIN ditolak aturan kata sandi server. Hubungi pengembang."
          : "Mohon maaf, akun belum berhasil dibuat. Silakan coba lagi.",
    };
  }

  for (let i = 1; i <= 20; i++) {
    const coba = i === 1 ? username : `${username.slice(0, 28)}${i}`;
    const { error } = await supabase
      .from("akun_generus")
      .insert({ user_id: dibuat.user.id, jamaah_id: j.id, username: coba });
    if (!error) {
      const { error: galatPin } = await supabase.rpc("atur_pin_generus", { p_user_id: dibuat.user.id, p_pin: pin });
      if (galatPin) {
        await adminAuth.auth.admin.deleteUser(dibuat.user.id);
        return { galat: "Mohon maaf, PIN belum berhasil disimpan. Silakan coba lagi." };
      }
      return { pesan: `Akun dibuat: @${coba}`, username: coba };
    }
    if (error.code !== "23505" || !error.message.includes("username") || !bolehAkhiran) {
      await adminAuth.auth.admin.deleteUser(dibuat.user.id);
      return {
        galat:
          error.code === "23505" && error.message.includes("username")
            ? `Username @${coba} sudah dipakai. Pilih yang lain.`
            : error.code === "23505"
              ? "Jamaah ini sudah punya akun."
              : "Mohon maaf, akun belum berhasil disimpan. Silakan coba lagi.",
      };
    }
  }
  await adminAuth.auth.admin.deleteUser(dibuat.user.id);
  return { galat: "Username sudah terpakai. Pilih yang lain." };
}

export async function buatAkunGenerus(jamaahId: string, _prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks(jamaahId);
  if (!ctx) return TIDAK_BERHAK;
  const username = bacaUsername(formData.get("username"));
  if (typeof username !== "string") return username;
  const pin = bacaPin(ctx.jamaah, formData.get("pin"));
  if (typeof pin !== "string") return pin;
  const hasil = await buat(ctx.supabase, ctx.jamaah, username, pin, false);
  if (!hasil.galat) refresh();
  return hasil;
}

/** Buat akun untuk semua generus aktif di kelompok yang belum punya akun dan tanggal lahirnya lengkap. */
export async function buatAkunKelompok(kelompokId: string): Promise<StateAksi> {
  const akses = await getAksesAbsensi();
  if (!akses?.kelompokAkun.some((k) => k.id === kelompokId)) return TIDAK_BERHAK;
  if (!createAdminClient()) return TANPA_KEY;
  const supabase = await createClient();
  const [{ data: generus }, { data: akun }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select("id, kode, nama_lengkap, nama_panggilan, tanggal_lahir")
      .eq("kelompok_id", kelompokId)
      .eq("aktif", true)
      .eq("termasuk_generus", true)
      .returns<Jamaah[]>(),
    supabase.from("akun_generus").select("jamaah_id").returns<{ jamaah_id: string }[]>(),
  ]);
  const punya = new Set((akun ?? []).map((a) => a.jamaah_id));
  let dibuat = 0;
  let tanpaTanggal = 0;
  let gagal = 0;
  for (const j of generus ?? []) {
    if (punya.has(j.id)) continue;
    const pin = pinDariTanggalLahir(j.tanggal_lahir);
    if (!pin) {
      tanpaTanggal++;
      continue;
    }
    const { data: boleh } = await supabase.rpc("boleh_kelola_akun_generus", { p_jamaah_id: j.id });
    if (!boleh) continue;
    const hasil = await buat(supabase, j, usulanUsername(j)[0], pin, true);
    if (hasil.galat) gagal++;
    else dibuat++;
  }
  refresh();
  return {
    pesan: [
      `${dibuat} akun dibuat.`,
      tanpaTanggal ? `${tanpaTanggal} dilewati (tanggal lahir belum lengkap, buat satu per satu).` : "",
      gagal ? `${gagal} gagal.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Kembalikan PIN ke PIN awal (tanggal lahir DDMMYY), buka kunci, wajib ganti
 * saat masuk. Admin tidak bisa mengetik PIN baru sendiri; setiap pengembalian
 * tercatat beserta alasannya (RPC kembalikan_pin_awal → riwayat_pin).
 */
export async function kembalikanPinAwal(jamaahId: string, _prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks(jamaahId);
  if (!ctx) return TIDAK_BERHAK;
  const alasan = String(formData.get("alasan") ?? "");
  const catatan = String(formData.get("catatan") ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  const { error } = await ctx.supabase.rpc("kembalikan_pin_awal", {
    p_jamaah_id: jamaahId,
    p_alasan: alasan,
    p_catatan: catatan || null,
  });
  if (error) {
    const pesan: Record<string, string> = {
      alasan: "Pilih alasannya.",
      catatan: "Tulis alasannya.",
      tanpa_akun: "Akun tidak ditemukan.",
      tanpa_tanggal_lahir: "Isi tanggal lahir jamaah dulu; PIN awal = tanggal lahir (DDMMYY).",
    };
    return { galat: pesan[error.hint ?? ""] ?? "Mohon maaf, PIN belum berhasil dikembalikan. Silakan coba lagi." };
  }
  refresh();
  return { pesan: "PIN kembali ke PIN awal (tanggal lahir DDMMYY). Ia wajib menggantinya saat masuk." };
}

export async function ubahUsername(jamaahId: string, _prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks(jamaahId);
  if (!ctx) return TIDAK_BERHAK;
  const username = bacaUsername(formData.get("username"));
  if (typeof username !== "string") return username;
  const { error } = await ctx.supabase.from("akun_generus").update({ username }).eq("jamaah_id", jamaahId);
  if (error) return { galat: error.code === "23505" ? `Username @${username} sudah dipakai.` : "Mohon maaf, belum berhasil disimpan. Silakan coba lagi." };
  refresh();
  return { pesan: "Tersimpan." };
}

export async function aturAkunAktif(jamaahId: string, aktif: boolean): Promise<StateAksi> {
  const ctx = await konteks(jamaahId);
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await ctx.supabase.from("akun_generus").update({ aktif }).eq("jamaah_id", jamaahId);
  if (error) return { galat: "Mohon maaf, belum berhasil disimpan. Silakan coba lagi." };
  refresh();
  return {};
}

export async function hapusAkunGenerus(jamaahId: string): Promise<StateAksi> {
  const ctx = await konteks(jamaahId);
  if (!ctx) return TIDAK_BERHAK;
  const { data: akun } = await ctx.supabase.from("akun_generus").select("user_id").eq("jamaah_id", jamaahId).maybeSingle();
  if (!akun) return { galat: "Akun tidak ditemukan." };
  const adminAuth = createAdminClient();
  if (!adminAuth) return TANPA_KEY;
  // Menghapus user Auth ikut menghapus baris akun_generus (on delete cascade).
  const { error } = await adminAuth.auth.admin.deleteUser(akun.user_id);
  if (error) return { galat: "Mohon maaf, akun belum berhasil dihapus. Silakan coba lagi." };
  refresh();
  return {};
}
