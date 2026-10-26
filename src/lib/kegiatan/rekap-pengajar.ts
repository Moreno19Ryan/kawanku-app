import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hariIniWib } from "@/lib/kegiatan/jadwal";

export type BarisPengajar = {
  nama: string;
  /** Jumlah sesi mengisi (satu pertemuan bisa beberapa sesi). */
  sesi: number;
  pertemuan: number;
  kegiatan: string[];
  wilayah: string[];
  /** Materi terbaru dulu, maksimal 3. */
  materi: string[];
};

type BarisPertemuan = {
  id: string;
  tanggal: string;
  kelompok_id: string | null;
  pemateri_nama: string | null;
  materi: string | null;
  kegiatan: { nama: string } | null;
  pertemuan_materi: { urutan: number; pemateri_nama: string | null; materi: string | null }[];
};

/** Pemateri per bulan ("YYYY-MM") dari pertemuan yang sudah berjalan & tidak libur (RLS: kegiatan.lihat). */
export async function getRekapPengajar(bulan: string, namaKelompok: Map<string, string>): Promise<BarisPengajar[]> {
  const awal = `${bulan}-01`;
  const [t, b] = bulan.split("-").map(Number);
  const akhirBulan = new Date(Date.UTC(t, b, 0)).toISOString().slice(0, 10);
  const hariIni = hariIniWib();
  const akhir = akhirBulan < hariIni ? akhirBulan : hariIni;
  if (akhir < awal) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("pertemuan")
    .select("id, tanggal, kelompok_id, pemateri_nama, materi, kegiatan:kegiatan_id(nama), pertemuan_materi(urutan, pemateri_nama, materi)")
    .eq("status", "terjadwal")
    .gte("tanggal", awal)
    .lte("tanggal", akhir)
    .order("tanggal", { ascending: false })
    .returns<BarisPertemuan[]>();

  const peta = new Map<string, BarisPengajar & { _pertemuan: Set<string> }>();
  for (const p of data ?? []) {
    const sesi = p.pertemuan_materi.length
      ? [...p.pertemuan_materi].sort((x, y) => x.urutan - y.urutan)
      : [{ urutan: 1, pemateri_nama: p.pemateri_nama, materi: p.materi }];
    for (const s of sesi) {
      const nama = s.pemateri_nama?.trim();
      if (!nama) continue;
      const kunci = nama.toLowerCase();
      const r = peta.get(kunci) ?? { nama, sesi: 0, pertemuan: 0, kegiatan: [], wilayah: [], materi: [], _pertemuan: new Set() };
      r.sesi += 1;
      r._pertemuan.add(p.id);
      const kegiatan = p.kegiatan?.nama;
      if (kegiatan && !r.kegiatan.includes(kegiatan)) r.kegiatan.push(kegiatan);
      const wilayah = p.kelompok_id ? (namaKelompok.get(p.kelompok_id) ?? "Kelompok") : "Desa";
      if (!r.wilayah.includes(wilayah)) r.wilayah.push(wilayah);
      if (s.materi && r.materi.length < 3 && !r.materi.includes(s.materi)) r.materi.push(s.materi);
      peta.set(kunci, r);
    }
  }
  return [...peta.values()]
    .map(({ _pertemuan, ...r }) => ({ ...r, pertemuan: _pertemuan.size }))
    .sort((a, b) => b.sesi - a.sesi || a.nama.localeCompare(b.nama));
}
