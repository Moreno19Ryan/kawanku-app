"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { dariInputWib } from "@/lib/waktu";
import { catatGalatSesi } from "./galat";

const TIDAK_BERHAK: StateAksi = { galat: "Mohon maaf, tindakan ini di luar wewenang akun ini." };
const GAGAL: StateAksi = { galat: "Mohon maaf, belum berhasil disimpan. Silakan coba lagi." };

/** Client + admin bila memegang izin global `izin` (RLS tetap pembatasnya). */
async function konteks(izin: string) {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || !punyaIzin(admin, izin)) return null;
  return { supabase, admin };
}

// ---------------------------------------------------------------------
// Mode perawatan (sistem.kelola)
// ---------------------------------------------------------------------

export async function simpanPerawatan(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const aktif = formData.get("aktif") === "on";
  const pesan = String(formData.get("pesan") ?? "").trim() || null;
  const perkiraanInput = String(formData.get("perkiraan_selesai") ?? "");
  const perkiraan = dariInputWib(perkiraanInput);
  if (pesan && pesan.length > 500) return { galat: "Pesan maksimal 500 karakter." };
  if (perkiraanInput && !perkiraan) return { galat: "Perkiraan selesai tidak valid." };

  const { data, error } = await ctx.supabase
    .from("pengaturan_sistem")
    .update({ mode_perawatan: aktif, pesan_perawatan: pesan, perkiraan_selesai: perkiraan })
    .eq("tunggal", true)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return {
    pesan: aktif
      ? "Mode perawatan AKTIF. Admin lain sekarang melihat halaman perawatan."
      : "Mode perawatan dimatikan.",
  };
}

// ---------------------------------------------------------------------
// Saklar fitur (sistem.kelola)
// ---------------------------------------------------------------------

export async function simpanFitur(
  fiturId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const aktif = formData.get("aktif") === "on";
  const semua = formData.get("cakupan") !== "pilih";
  const kelompok = formData.getAll("kelompok").map(String).filter(Boolean);
  if (aktif && !semua && kelompok.length === 0) {
    return { galat: "Pilih minimal satu kelompok, atau pilih “Semua kelompok”." };
  }

  const { data, error } = await ctx.supabase
    .from("fitur")
    .update({ aktif, semua_kelompok: semua })
    .eq("id", fiturId)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  // Ganti daftar kelompok sekaligus (hapus lalu isi ulang).
  const { error: galatHapus } = await ctx.supabase
    .from("fitur_kelompok")
    .delete()
    .eq("fitur_id", fiturId);
  if (galatHapus) return GAGAL;
  if (!semua && kelompok.length > 0) {
    const { error: galatIsi } = await ctx.supabase
      .from("fitur_kelompok")
      .insert(kelompok.map((kelompok_id) => ({ fitur_id: fiturId, kelompok_id })));
    if (galatIsi) return GAGAL;
  }

  refresh();
  return { pesan: "Tersimpan." };
}

// ---------------------------------------------------------------------
// Pengumuman (pengumuman.kelola)
// ---------------------------------------------------------------------

export async function buatPengumuman(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks("pengumuman.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const pesan = String(formData.get("pesan") ?? "").trim().replace(/\s+/g, " ");
  const nada = formData.get("nada") === "peringatan" ? "peringatan" : "info";
  const mulaiInput = String(formData.get("mulai") ?? "");
  const berakhirInput = String(formData.get("berakhir") ?? "");
  const mulai = mulaiInput ? dariInputWib(mulaiInput) : new Date().toISOString();
  const berakhir = berakhirInput ? dariInputWib(berakhirInput) : null;

  if (!pesan) return { galat: "Isi pesan pengumuman." };
  if (pesan.length > 300) return { galat: "Pesan maksimal 300 karakter." };
  if (!mulai || (berakhirInput && !berakhir)) return { galat: "Tanggal tidak valid." };
  if (berakhir && berakhir <= mulai) return { galat: "Waktu berakhir harus setelah waktu mulai." };

  const sasaranInput = String(formData.get("sasaran") ?? "admin");
  const sasaran = ["admin", "generus", "semua"].includes(sasaranInput) ? sasaranInput : "admin";

  const { error } = await ctx.supabase.from("pengumuman").insert({ pesan, nada, mulai, berakhir, sasaran });
  if (error) return GAGAL;

  refresh();
  return { pesan: "Pengumuman dibuat." };
}

export async function ubahStatusPengumuman(id: string, aktif: boolean): Promise<StateAksi> {
  const ctx = await konteks("pengumuman.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const { data, error } = await ctx.supabase
    .from("pengumuman")
    .update({ aktif })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: aktif ? "Pengumuman ditayangkan." : "Pengumuman disembunyikan." };
}

export async function hapusPengumuman(id: string): Promise<StateAksi> {
  const ctx = await konteks("pengumuman.kelola");
  if (!ctx) return TIDAK_BERHAK;

  const { data, error } = await ctx.supabase.from("pengumuman").delete().eq("id", id).select("id");
  if (error || data.length === 0) return GAGAL;

  refresh();
  return { pesan: "Pengumuman dihapus." };
}

/** Setujui (berlaku 1 jam) / tolak permintaan melihat NIK/KK lengkap. Hanya pengembang (RPC). */
export async function tanganiPermintaanIdentitas(id: string, setuju: boolean): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await ctx.supabase.rpc("tangani_permintaan_identitas", { p_id: id, p_setuju: setuju });
  if (error?.hint === "sendiri") return { galat: "Permintaan milik sendiri tidak bisa disetujui sendiri; silakan minta pengembang lain." };
  if (error?.hint === "sudah") return { galat: "Permintaan ini sudah ditangani." };
  if (error) return { galat: "Mohon maaf, belum berhasil. Fitur ini khusus pengembang." };
  refresh();
  return { pesan: setuju ? "Disetujui (berlaku 1 jam)." : "Ditolak." };
}

// ---------------------------------------------------------------------
// Pemantau galat
// ---------------------------------------------------------------------

/**
 * Dipanggil halaman galat di browser untuk galat yang terjadi di klien
 * (galat server sudah dicatat onRequestError). Siapa pun boleh memanggil;
 * RPC catat_galat memotong isi & membatasi jumlah baris.
 */
export async function laporGalatKlien(pesan: string, rute: string): Promise<void> {
  if (typeof pesan !== "string" || typeof rute !== "string") return;
  await catatGalatSesi({ sumber: "klien", pesan, rute, jenis: "klien" });
}

/** Tandai satu galat (atau semua yang belum, bila id null) sudah dicek. Hanya pengembang (RLS). */
export async function tandaiGalatDicek(id: string | null): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;
  let q = ctx.supabase
    .from("galat_aplikasi")
    .update({ dicek_at: new Date().toISOString(), dicek_oleh: ctx.admin.userId })
    .is("dicek_at", null);
  if (id) q = q.eq("id", id);
  const { data, error } = await q.select("id");
  if (error) return GAGAL;
  refresh();
  return { pesan: id ? "Ditandai sudah dicek." : `${data.length} galat ditandai sudah dicek.` };
}

// ---------------------------------------------------------------------
// Tugas otomatis (sistem.kelola): jalankan sekarang & nyalakan/matikan
// ---------------------------------------------------------------------

export async function jalankanTugas(nama: string): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase.rpc("jalankan_tugas", { p_nama: nama });
  if (error) return { galat: `Mohon maaf, tugas belum berhasil dijalankan. Keterangan teknis: ${error.message}` };
  refresh();
  return { pesan: `Alhamdulillah, selesai (${Number(data ?? 0)} diproses).` };
}

export async function aturTugas(nama: string, aktif: boolean): Promise<StateAksi> {
  const ctx = await konteks("sistem.kelola");
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await ctx.supabase.rpc("atur_tugas", { p_nama: nama, p_aktif: aktif });
  if (error) return GAGAL;
  refresh();
  return { pesan: aktif ? "Tugas dinyalakan." : "Tugas dimatikan." };
}
