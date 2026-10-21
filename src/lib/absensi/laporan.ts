import "server-only";
import { getAksesAbsensi, KOLOM_SESI, type Sesi } from "@/lib/absensi/akses";
import {
  daftarBulan,
  hitungLaporan,
  type CatatanLaporan,
  type JamaahLaporan,
  type Laporan,
  type StatusJamaah,
} from "@/lib/absensi/laporan-hitung";
import { pilihanWilayah } from "@/lib/absensi/rekap";
import { createClient } from "@/lib/supabase/server";

/**
 * Laporan & monitoring kehadiran (Fase 3b). Dibaca dengan sesi admin (RLS),
 * sama dengan rekap: admin generus hanya melihat generus, admin kelompok
 * hanya kelompoknya. Perhitungan di laporan-hitung.ts (murni).
 */

export type ParamLaporan = {
  /** "desa" atau id kelompok. */
  wilayah: string;
  peserta: "semua" | "generus";
  rentang: 3 | 6 | 12;
  status: StatusJamaah | "semua";
};

const RENTANG = [3, 6, 12] as const;
const STATUS: ParamLaporan["status"][] = ["semua", "perlu_disapa", "menurun", "jarang", "rajin", "biasa"];

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function bacaParamLaporan(cari: Record<string, string | string[] | undefined>): ParamLaporan {
  const rentang = Number(satu(cari.rentang));
  const status = satu(cari.status) as ParamLaporan["status"];
  return {
    wilayah: satu(cari.wilayah),
    peserta: satu(cari.peserta) === "generus" ? "generus" : "semua",
    rentang: (RENTANG as readonly number[]).includes(rentang) ? (rentang as ParamLaporan["rentang"]) : 3,
    status: STATUS.includes(status) ? status : "semua",
  };
}

export function queryLaporan(p: ParamLaporan, ubah: Partial<ParamLaporan> = {}): string {
  const x = { ...p, ...ubah };
  const q = new URLSearchParams({ wilayah: x.wilayah, peserta: x.peserta, rentang: String(x.rentang) });
  if (x.status !== "semua") q.set("status", x.status);
  return q.toString();
}

const KOLOM_JAMAAH = "id, kode, nama_lengkap, kelompok_id, kategori_jamaah_nama, termasuk_generus, created_at";
const HALAMAN = 1000;
const POTONG = 100;

function potong<T>(xs: T[], n = POTONG): T[][] {
  return Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));
}

export async function getLaporan(
  param: ParamLaporan,
): Promise<{ param: ParamLaporan; laporan: Laporan; wilayah: { id: string; nama: string }[]; namaWilayah: string } | null> {
  const akses = await getAksesAbsensi();
  if (!akses?.bolehLihat) return null;
  const wilayah = pilihanWilayah(akses);
  if (!wilayah.length) return null;
  const p = { ...param, wilayah: wilayah.some((w) => w.id === param.wilayah) ? param.wilayah : wilayah[0].id };
  const supabase = await createClient();
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const kelompokIds = p.wilayah === "desa" ? akses.kelompokLihat.map((k) => k.id) : [p.wilayah];
  const generusSaja = p.peserta === "generus";

  const sekarang = new Date();
  const bulan = daftarBulan(p.rentang, sekarang);
  const awal = `${bulan[0]}-01T00:00:00+07:00`;

  // --- Sesi -------------------------------------------------------------
  // Sasaran sesi tidak disaring di sini: peserta tiap sesi ditentukan per
  // jamaah (sesi generus hanya dihitung untuk generus).
  const { data: sesiData } = await supabase
    .from("sesi_absensi")
    .select(KOLOM_SESI)
    .gte("mulai", awal)
    .lte("mulai", sekarang.toISOString())
    .or(`kelompok_id.is.null,kelompok_id.in.(${kelompokIds.join(",")})`)
    .order("mulai")
    .limit(2000)
    .returns<Sesi[]>();
  const sesi = sesiData ?? [];

  // --- Peserta ----------------------------------------------------------
  const jamaah: JamaahLaporan[] = [];
  for (let dari = 0; ; dari += HALAMAN) {
    let qj = supabase
      .from("jamaah_dengan_kategori")
      .select(KOLOM_JAMAAH)
      .eq("aktif", true)
      .in("kelompok_id", kelompokIds)
      .order("id")
      .range(dari, dari + HALAMAN - 1);
    if (generusSaja) qj = qj.eq("termasuk_generus", true);
    const { data } = await qj.returns<JamaahLaporan[]>();
    jamaah.push(...(data ?? []));
    if (!data || data.length < HALAMAN) break;
  }

  // --- Catatan absensi & nama kegiatan -----------------------------------
  const idPeserta = new Set(jamaah.map((j) => j.id));
  const catatan: CatatanLaporan[] = [];
  const kegiatanSesi = new Map<string, string>();
  await Promise.all(
    potong(sesi.map((s) => s.id)).map(async (ids) => {
      for (let dari = 0; ; dari += HALAMAN) {
        const { data } = await supabase
          .from("absensi")
          .select("sesi_id, jamaah_id, status")
          .in("sesi_id", ids)
          .order("id")
          .range(dari, dari + HALAMAN - 1)
          .returns<CatatanLaporan[]>();
        catatan.push(...(data ?? []).filter((c) => idPeserta.has(c.jamaah_id)));
        if (!data || data.length < HALAMAN) break;
      }
      const { data: pertemuan } = await supabase
        .from("pertemuan")
        .select("sesi_id, kegiatan:kegiatan_id (nama)")
        .in("sesi_id", ids)
        .returns<{ sesi_id: string; kegiatan: { nama: string } | null }[]>();
      for (const x of pertemuan ?? []) if (x.kegiatan) kegiatanSesi.set(x.sesi_id, x.kegiatan.nama);
    }),
  );

  const laporan = hitungLaporan({ sesi, jamaah, catatan, namaKelompok, kegiatanSesi, bulan, sekarang });
  return { param: p, laporan, wilayah, namaWilayah: wilayah.find((w) => w.id === p.wilayah)?.nama ?? "" };
}
