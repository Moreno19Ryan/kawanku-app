import "server-only";
import { getAksesAbsensi, bolehKelolaSesi, KOLOM_SESI, type Sesi } from "@/lib/absensi/akses";
import { getPengajuanIzin } from "@/lib/absensi/izin";
import { bacaParamLaporan, getLaporan } from "@/lib/absensi/laporan";
import { getAksesKegiatan, bolehKelolaPertemuan } from "@/lib/kegiatan/akses";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari, type Kejadian } from "@/lib/kegiatan/jadwal";
import type { GenerusSaatIni } from "@/lib/generus/akun";
import { hitungKelengkapan } from "@/lib/generus/kelengkapan";
import { createClient } from "@/lib/supabase/server";
import {
  saranGenerus,
  saranIzin,
  saranKegiatan,
  saranLaporan,
  saranSesiTerbuka,
  urutkanSaran,
  type Saran,
} from "./hitung";

/** Jalankan satu sumber saran; galat di satu bagian tidak menggagalkan yang lain. */
async function aman(f: () => Promise<Saran[]>): Promise<Saran[]> {
  try {
    return await f();
  } catch {
    return [];
  }
}

/** Saran untuk admin yang login, sesuai wewenang & modul yang menyala (batas data tetap RLS). */
export async function getSaranAdmin(): Promise<Saran[]> {
  const [absensi, kegiatan] = await Promise.all([getAksesAbsensi(), getAksesKegiatan()]);
  const supabase = await createClient();
  const sekarang = new Date();

  const bagian = await Promise.all([
    aman(async () => {
      if (!kegiatan || kegiatan.kelompokLihat.length === 0) return [];
      const hariIni = hariIniWib(sekarang);
      const kejadian = await getKalender(hariIni, tambahHari(hariIni, 6), kegiatan.kelompokLihat.map((k) => k.id));
      return saranKegiatan(kejadian, (k) => bolehKelolaPertemuan(kegiatan, k.kelompokId, k.kegiatan.hanya_generus), sekarang);
    }),
    aman(async () => {
      if (!absensi?.bolehLihat || absensi.kelompokKelola.length === 0) return [];
      const { data } = await supabase
        .from("sesi_absensi")
        .select(KOLOM_SESI)
        .eq("ditutup", false)
        // Yang otomatis menutup sendiri; pengingat hanya untuk yang dibuka manual.
        .eq("dibuka_manual", true)
        .order("mulai")
        .limit(50)
        .returns<Sesi[]>();
      return saranSesiTerbuka((data ?? []).filter((s) => bolehKelolaSesi(absensi, s)), sekarang);
    }),
    aman(async () => {
      if (!absensi?.bolehLihat) return [];
      const izin = await getPengajuanIzin({ menunggu: true });
      return saranIzin(izin.filter((i) => i.bolehTangani).length);
    }),
    aman(async () => {
      if (!absensi?.bolehLihat) return [];
      const hasil = await getLaporan(bacaParamLaporan({}));
      return hasil ? saranLaporan(hasil.laporan) : [];
    }),
  ]);
  return urutkanSaran(bagian.flat());
}

/** Saran untuk generus yang login (hanya data dirinya, lewat RLS). */
export async function getSaranGenerus(generus: GenerusSaatIni, jadwal: Kejadian[] = []): Promise<Saran[]> {
  return aman(async () => {
    const supabase = await createClient();
    const sepekan = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const [{ data: izin }, { data: kontak }, { data: pribadi }, { data: diri }] = await Promise.all([
      supabase
        .from("pengajuan_izin")
        .select("id, status, tanggal, tanggapan, kegiatan:kegiatan_id(nama)")
        .eq("jamaah_id", generus.jamaah.id)
        .in("status", ["disetujui", "ditolak"])
        .gte("ditangani_at", sepekan)
        .order("ditangani_at", { ascending: false })
        .limit(3)
        .returns<{ id: string; status: "disetujui" | "ditolak"; tanggal: string; tanggapan: string | null; kegiatan: { nama: string } | null }[]>(),
      supabase
        .from("jamaah_kontak")
        .select("no_hp, no_hp_wali")
        .eq("jamaah_id", generus.jamaah.id)
        .maybeSingle<{ no_hp: string | null; no_hp_wali: string | null }>(),
      supabase
        .from("jamaah_pribadi")
        .select("ktp_wilayah, ktp_jalan, nama_ayah, nama_ibu")
        .eq("jamaah_id", generus.jamaah.id)
        .maybeSingle<{ ktp_wilayah: string | null; ktp_jalan: string | null; nama_ayah: string | null; nama_ibu: string | null }>(),
      supabase
        .from("jamaah")
        .select("tanggal_lahir, tempat_lahir, status_sekolah, kelas")
        .eq("id", generus.jamaah.id)
        .maybeSingle<{ tanggal_lahir: string | null; tempat_lahir: string | null; status_sekolah: string | null; kelas: number | null }>(),
    ]);
    return urutkanSaran(
      saranGenerus({
        izin: (izin ?? []).map((i) => ({ ...i, kegiatan: i.kegiatan?.nama ?? "Pertemuan" })),
        kelengkapan: hitungKelengkapan({
          tanggal_lahir: diri?.tanggal_lahir ?? null,
          tempat_lahir: diri?.tempat_lahir ?? null,
          status_sekolah: diri?.status_sekolah ?? null,
          kelas: diri?.kelas ?? null,
          no_hp: kontak?.no_hp ?? null,
          no_hp_wali: kontak?.no_hp_wali ?? null,
          nama_ayah: pribadi?.nama_ayah ?? null,
          nama_ibu: pribadi?.nama_ibu ?? null,
          ada_alamat: Boolean(pribadi?.ktp_wilayah || pribadi?.ktp_jalan),
        }),
        jadwal,
      }),
    );
  });
}
