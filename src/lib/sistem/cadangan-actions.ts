"use server";

import { refresh } from "next/cache";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

const TIDAK_BERHAK: StateAksi = { galat: "Khusus pengembang." };
const JENIS = ["harian", "mingguan", "bulanan", "tahunan"] as const;

async function konteks() {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || !punyaIzin(admin, "sistem.kelola")) return null;
  return supabase;
}

/** Simpan jadwal cadangan: nyala/mati & jumlah yang disimpan per jenis. */
export async function simpanJadwalCadangan(_prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const supabase = await konteks();
  if (!supabase) return TIDAK_BERHAK;
  for (const jenis of JENIS) {
    const simpan = Number(fd.get(`simpan_${jenis}`));
    if (!Number.isInteger(simpan) || simpan < 1 || simpan > 60) {
      return { galat: "Jumlah yang disimpan harus 1–60." };
    }
    const { error } = await supabase
      .from("cadangan_jadwal")
      .update({ aktif: fd.get(`aktif_${jenis}`) === "on", simpan })
      .eq("jenis", jenis);
    if (error) return { galat: "Mohon maaf, jadwal belum berhasil disimpan. Silakan coba lagi." };
  }
  refresh();
  return { pesan: "Jadwal cadangan tersimpan." };
}

export async function cadangkanSekarang(): Promise<StateAksi> {
  const supabase = await konteks();
  if (!supabase) return TIDAK_BERHAK;
  const { data: id, error } = await supabase.rpc("cadangkan_sekarang");
  if (error) return { galat: "Mohon maaf, cadangan belum berhasil dibuat. Silakan coba lagi." };
  const { data } = await supabase.from("cadangan").select("status, pesan").eq("id", id).maybeSingle();
  refresh();
  if (data?.status !== "berhasil") return { galat: `Cadangan gagal: ${data?.pesan ?? "tanpa keterangan"}` };
  return { pesan: "Cadangan dibuat. Alhamdulillah." };
}

export async function periksaCadangan(id: string): Promise<StateAksi> {
  const supabase = await konteks();
  if (!supabase) return TIDAK_BERHAK;
  const { data, error } = await supabase.rpc("periksa_cadangan", { p_id: id });
  if (error) return { galat: "Mohon maaf, cadangan belum berhasil diperiksa. Silakan coba lagi." };
  refresh();
  return data === "cocok" ? { pesan: "Cadangan utuh dan bisa dibuka." } : { galat: "Cadangan RUSAK. Buat cadangan baru." };
}

/** Pulihkan satu baris dari cadangan (insert atau timpa), tercatat. */
export async function pulihkanBaris(id: string, tabel: string, baris: string): Promise<StateAksi> {
  const supabase = await konteks();
  if (!supabase) return TIDAK_BERHAK;
  const { error } = await supabase.rpc("pulihkan_dari_cadangan", { p_id: id, p_tabel: tabel, p_baris: baris });
  if (error) return { galat: `Mohon maaf, baris belum berhasil dipulihkan: ${error.message}` };
  refresh();
  return { pesan: "Baris dipulihkan dan tercatat di riwayat." };
}
