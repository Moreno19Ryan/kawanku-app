import "server-only";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { getAdminSaatIni, punyaIzin } from "@/lib/auth/admin";
import { getPengajuanIzin } from "@/lib/absensi/izin";
import { bacaParamLaporan, getLaporan } from "@/lib/absensi/laporan";
import { getSapaanTerakhir } from "@/lib/absensi/sapaan";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { getAksesKegiatan, bolehKelolaPertemuan } from "@/lib/kegiatan/akses";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari, type Kejadian } from "@/lib/kegiatan/jadwal";
import type { GenerusSaatIni } from "@/lib/generus/akun";
import { hitungKelengkapan } from "@/lib/generus/kelengkapan";
import { createClient } from "@/lib/supabase/server";
import {
  saranDataGanda,
  saranGalat,
  saranGenerus,
  saranIzin,
  saranKegiatan,
  saranLaporan,
  saranPermintaanIdentitas,
  saranLaporanBulanan,
  saranPengajar,
  saranPola,
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
  const [admin, absensi, kegiatan] = await Promise.all([getAdminSaatIni(), getAksesAbsensi(), getAksesKegiatan()]);
  const sekarang = new Date();

  const bagian = await Promise.all([
    aman(async () => {
      if (!kegiatan || kegiatan.kelompokLihat.length === 0) return [];
      const hariIni = hariIniWib(sekarang);
      const kejadian = await getKalender(hariIni, tambahHari(hariIni, 6), kegiatan.kelompokLihat.map((k) => k.id));
      return saranKegiatan(kejadian, (k) => bolehKelolaPertemuan(kegiatan, k.kelompokId, k.kegiatan.hanya_generus), sekarang);
    }),
    aman(async () => {
      if (!kegiatan || kegiatan.kelompokLihat.length === 0) return [];
      const hariIni = hariIniWib(sekarang);
      const kejadian = await getKalender(tambahHari(hariIni, -28), hariIni, kegiatan.kelompokLihat.map((k) => k.id));
      let hadir: Map<string, number> | null = null;
      const sesi = kejadian.flatMap((k) => (k.sesiId ? [k.sesiId] : []));
      if (absensi?.bolehLihat && sesi.length) {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("absensi")
          .select("sesi_id")
          .in("sesi_id", sesi)
          .eq("status", "hadir")
          .returns<{ sesi_id: string }[]>();
        if (!error) {
          hadir = new Map();
          for (const a of data) hadir.set(a.sesi_id, (hadir.get(a.sesi_id) ?? 0) + 1);
        }
      }
      const nama = new Map(kegiatan.kelompokLihat.map((k) => [k.id, k.nama]));
      return saranPola({
        kejadian,
        hadir,
        namaWilayah: (id) => (id ? (nama.get(id) ?? "Kelompok") : "Desa"),
        bolehKelola: (k) => bolehKelolaPertemuan(kegiatan, k.kelompokId, k.kegiatan.hanya_generus),
        sekarang,
      });
    }),
    aman(async () => {
      // Pengajar rutin di wilayah yang dikelola admin ini, yang lama tidak mengisi.
      if (!kegiatan || (kegiatan.kelompokKelola.length === 0 && !kegiatan.kelolaDesa)) return [];
      const supabase = await createClient();
      const wilayah = kegiatan.kelompokKelola.map((k) => k.id);
      let q = supabase.from("pengajar").select("id, nama, kelompok_id, created_at").eq("aktif", true);
      q = kegiatan.kelolaDesa
        ? wilayah.length
          ? q.or(`kelompok_id.is.null,kelompok_id.in.(${wilayah.join(",")})`)
          : q.is("kelompok_id", null)
        : q.in("kelompok_id", wilayah);
      const { data: pengajar } = await q.returns<{ id: string; nama: string; kelompok_id: string | null; created_at: string }[]>();
      if (!pengajar?.length) return [];
      const { data: isi } = await supabase
        .from("pertemuan_materi")
        .select("pengajar_id, pertemuan:pertemuan_id!inner(tanggal, status)")
        .in("pengajar_id", pengajar.map((p) => p.id))
        .eq("pertemuan.status", "terjadwal")
        .lte("pertemuan.tanggal", hariIniWib(sekarang))
        .returns<{ pengajar_id: string; pertemuan: { tanggal: string } }[]>();
      const terakhir = new Map<string, string>();
      for (const r of isi ?? []) {
        if ((terakhir.get(r.pengajar_id) ?? "") < r.pertemuan.tanggal) terakhir.set(r.pengajar_id, r.pertemuan.tanggal);
      }
      return saranPengajar({ pengajar, terakhir, sekarang });
    }),
    aman(async () => {
      const jamaah = await getAksesJamaah();
      if (!jamaah || jamaah.kelompokUbah.length === 0) return [];
      const supabase = await createClient();
      const { data } = await supabase
        .from("jamaah")
        .select("id, nama_lengkap, tanggal_lahir, tahun_lahir")
        .eq("aktif", true)
        .in("kelompok_id", jamaah.kelompokUbah.map((k) => k.id))
        .limit(5000)
        .returns<{ id: string; nama_lengkap: string; tanggal_lahir: string | null; tahun_lahir: number | null }[]>();
      return saranDataGanda(data ?? []);
    }),
    aman(async () => {
      if (!admin || !punyaIzin(admin, "sistem.kelola")) return [];
      const supabase = await createClient();
      const sepekan = new Date(sekarang.getTime() - 7 * 24 * 3600_000).toISOString();
      const { data } = await supabase
        .from("galat_aplikasi")
        .select("jumlah")
        .is("dicek_at", null)
        .gte("terakhir_at", sepekan)
        .returns<{ jumlah: number }[]>();
      return saranGalat(data?.length ?? 0, (data ?? []).reduce((n, g) => n + g.jumlah, 0));
    }),
    aman(async () => {
      if (!admin || !punyaIzin(admin, "sistem.kelola")) return [];
      const supabase = await createClient();
      const { count } = await supabase
        .from("permintaan_identitas")
        .select("id", { count: "exact", head: true })
        .eq("status", "menunggu");
      return saranPermintaanIdentitas(count ?? 0);
    }),
    aman(async () => (absensi?.bolehLihat ? saranLaporanBulanan(sekarang) : [])),
    aman(async () => {
      if (!absensi?.bolehLihat) return [];
      const izin = await getPengajuanIzin({ menunggu: true });
      return saranIzin(izin.filter((i) => i.bolehTangani).length);
    }),
    aman(async () => {
      if (!absensi?.bolehLihat) return [];
      const hasil = await getLaporan(bacaParamLaporan({}));
      if (!hasil) return [];
      const ids = hasil.laporan.jamaah
        .filter((b) => b.status === "perlu_disapa" || b.status === "mulai_jarang")
        .map((b) => b.id);
      const batas = new Date(sekarang.getTime() - 14 * 24 * 3600_000).toISOString();
      const sapaan = await getSapaanTerakhir(ids);
      const sudah = new Set([...sapaan.values()].filter((s) => s.created_at >= batas).map((s) => s.jamaah_id));
      return saranLaporan(hasil.laporan, sudah);
    }),
  ]);
  return urutkanSaran(bagian.flat());
}

/** Saran untuk generus yang login (hanya data dirinya, lewat RLS). */
export async function getSaranGenerus(generus: GenerusSaatIni, jadwal: Kejadian[] = []): Promise<Saran[]> {
  return aman(async () => {
    const supabase = await createClient();
    const sepekan = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const duaPekan = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const [{ data: izin }, { data: kontak }, { data: pribadi }, { data: diri }, { data: pin }] = await Promise.all([
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
      supabase
        .from("riwayat_pin")
        .select("id, created_at")
        .eq("jamaah_id", generus.jamaah.id)
        .gte("created_at", duaPekan)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; created_at: string }>(),
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
        pinDikembalikan: pin,
      }),
    );
  });
}
