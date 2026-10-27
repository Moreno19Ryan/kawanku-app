"use server";

import { refresh } from "next/cache";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { hasilAksi } from "@/lib/jamaah/kenaikan";
import { getCalonKenaikan } from "@/lib/jamaah/kenaikan-data";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Terapkan kenaikan kelas sekelompok sekaligus. Hasil dihitung ulang di
 * server dari data terkini (bukan dari isian), lalu dikirim ke RPC
 * terapkan_kenaikan_kelas (satu transaksi, tetap RLS, tidak naik dua kali).
 */
export async function terapkanKenaikanKelas(
  kelompokId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const akses = await getAksesJamaah();
  if (!akses?.kelompokUbah.some((k) => k.id === kelompokId)) {
    return { galat: "Mohon maaf, akun ini belum memiliki izin mengubah data jamaah kelompok ini." };
  }

  const calon = await getCalonKenaikan(kelompokId);
  const perubahan = calon
    .map((j) => {
      const hasil = hasilAksi(j.status_sekolah, j.kelas, String(formData.get(`aksi:${j.id}`) ?? "lewati"));
      return hasil && { id: j.id, ...hasil };
    })
    .filter((x) => x !== null);
  if (perubahan.length === 0) return { galat: "Belum ada perubahan yang dipilih." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("terapkan_kenaikan_kelas", {
    p_kelompok_id: kelompokId,
    p_perubahan: perubahan,
  });
  if (error) {
    return {
      galat:
        error.code === "42501"
          ? "Tidak bisa disimpan: sebagian hasilnya di luar wewenang akun ini (mis. admin generus membuat jamaah tidak lagi berkategori generus). Tidak ada yang diubah."
          : "Mohon maaf, belum berhasil disimpan, dan tidak ada data yang berubah. Silakan coba lagi.",
    };
  }

  refresh();
  const n = Number(data ?? 0);
  return {
    pesan:
      n === perubahan.length
        ? `Alhamdulillah, ${n} jamaah diperbarui. Kategori ikut menyesuaikan otomatis.`
        : `${n} dari ${perubahan.length} jamaah diperbarui; sisanya sudah diperbarui orang lain atau di luar wewenang akun ini.`,
  };
}
