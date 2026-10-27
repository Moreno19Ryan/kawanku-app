"use server";

import { createClient } from "@/lib/supabase/server";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import type { DataKesehatan } from "./kesehatan";
import {
  BATAS_CERITA,
  PILIHAN_RENTANG,
  susunLaporan,
  type GalatLaporan,
  type JejakLaporan,
} from "./laporan-masalah";

export type HasilLaporan = { galat?: string; teks?: string };

/**
 * Kumpulkan bahan "Salin laporan masalah" (hanya sistem.kelola). Bagian yang
 * gagal dibaca ditulis "(tidak terbaca)", supaya laporan tetap jadi saat
 * sebagian sistem bermasalah.
 */
export async function susunLaporanMasalah(_prev: HasilLaporan, formData: FormData): Promise<HasilLaporan> {
  const supabase = await createClient();
  const admin = await bacaAdmin(supabase);
  if (!admin || !punyaIzin(admin, "sistem.kelola")) {
    return { galat: "Mohon maaf, tindakan ini di luar wewenang akun ini." };
  }

  const jamDiminta = Number(formData.get("rentang"));
  const rentangJam = PILIHAN_RENTANG.some((p) => p.jam === jamDiminta) ? jamDiminta : 24;
  const cerita = String(formData.get("cerita") ?? "").trim().slice(0, BATAS_CERITA) || null;
  const sekarang = new Date();
  const sejak = new Date(sekarang.getTime() - rentangJam * 3_600_000).toISOString();

  const [kesehatan, pengaturan, periksa, galat, jejak, admins] = await Promise.all([
    supabase.rpc("kesehatan_sistem"),
    supabase.from("pengaturan_sistem").select("mode_perawatan").maybeSingle(),
    supabase.rpc("periksa_data"),
    supabase
      .from("galat_aplikasi")
      .select("sumber, jenis, rute, pesan, digest, jumlah, pertama_at, terakhir_at, dicek_at")
      .or(`dicek_at.is.null,terakhir_at.gte.${sejak}`)
      .order("terakhir_at", { ascending: false })
      .limit(20)
      .returns<GalatLaporan[]>(),
    supabase
      .from("jejak_aktivitas")
      .select("tabel, aksi, kolom, oleh, created_at", { count: "exact" })
      .gte("created_at", sejak)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<(Omit<JejakLaporan, "oleh"> & { oleh: string | null })[]>(),
    supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
  ]);

  const nama = new Map((admins.data ?? []).map((a) => [a.user_id, a.nama]));

  const teks = susunLaporan({
    dibuat: sekarang.toISOString(),
    rentangJam,
    cerita,
    pelapor: admin.nama,
    versi: {
      lingkungan: process.env.VERCEL_ENV ?? "lokal",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      pesanCommit: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    perawatan: pengaturan.error || !pengaturan.data ? null : pengaturan.data.mode_perawatan,
    kesehatan: kesehatan.error ? null : (kesehatan.data as DataKesehatan),
    periksa: periksa.error ? null : (periksa.data as { judul: string; jumlah: number }[]),
    galat: galat.error ? null : galat.data,
    jejak: jejak.error
      ? null
      : jejak.data.map((j) => ({
          ...j,
          oleh: j.oleh ? (nama.get(j.oleh) ?? "Generus/akun lain") : "Sistem",
        })),
    jejakTotal: jejak.error ? null : jejak.count,
  });

  return { teks };
}
