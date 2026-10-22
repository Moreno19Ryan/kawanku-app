"use client";

import { addTransitionType, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { langganan } from "@/lib/supabase/realtime";

/**
 * Tabel yang perubahannya membuat halaman dimuat ulang otomatis. Isi
 * perubahan tidak dipakai; Realtime hanya mengirim perubahan baris yang
 * boleh dibaca pengguna ini (RLS), lalu halaman mengambil data terbaru
 * dari server seperti biasa.
 */
const TABEL = [
  "jamaah",
  "keluarga",
  "kategori_jamaah",
  "kelompok",
  "absensi",
  "sesi_absensi",
  "kartu_qr",
  "akun_generus",
  "kegiatan",
  "kegiatan_jadwal",
  "pertemuan",
  "pengumuman",
  "pengajuan_izin",
  "usulan_koreksi",
  "perubahan_data_generus",
  "fitur",
  "fitur_kelompok",
  "pengaturan_sistem",
] as const;

/** Jeda supaya rentetan perubahan (mis. scan beruntun) cukup sekali muat ulang. */
const JEDA_MS = 700;
/** Tab yang lama tersembunyi dimuat ulang saat dibuka lagi, walau tanpa kabar Realtime. */
const BASI_MS = 30_000;

/**
 * Membuat halaman selalu terbaru tanpa menekan refresh: dimuat ulang
 * otomatis saat data berubah di perangkat lain (Supabase Realtime), saat
 * tab dibuka lagi, dan saat koneksi kembali. Isian form yang sedang
 * diketik tidak hilang (hanya data dari server yang diperbarui).
 */
export function SegarkanLangsung() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tertunda = false;
    let terakhir = Date.now();

    const muatUlang = () => {
      tertunda = false;
      terakhir = Date.now();
      // Pembaruan diam-diam: tanpa animasi pindah halaman.
      startTransition(() => {
        addTransitionType("diam");
        router.refresh();
      });
    };
    const adaPerubahan = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") muatUlang();
        else tertunda = true;
      }, JEDA_MS);
    };
    const saatTerlihat = () => {
      if (document.visibilityState !== "visible") return;
      if (tertunda || Date.now() - terakhir > BASI_MS) muatUlang();
    };
    const saatTersembunyi = () => {
      if (document.visibilityState === "hidden") terakhir = Date.now();
    };

    const berhenti = langganan(supabase, "kawanku-segarkan", (kanal) => {
      for (const table of TABEL) {
        kanal.on("postgres_changes", { event: "*", schema: "public", table }, adaPerubahan);
      }
      return kanal;
    });

    document.addEventListener("visibilitychange", saatTerlihat);
    document.addEventListener("visibilitychange", saatTersembunyi);
    window.addEventListener("online", muatUlang);
    return () => {
      clearTimeout(timer);
      berhenti();
      document.removeEventListener("visibilitychange", saatTerlihat);
      document.removeEventListener("visibilitychange", saatTersembunyi);
      window.removeEventListener("online", muatUlang);
    };
  }, [router]);

  return null;
}
