import "server-only";
import ExcelJS from "exceljs";
import { getAdminSaatIni, type AdminSaatIni } from "@/lib/auth/admin";
import { ringkasJadwal, type Jadwal } from "@/lib/kegiatan/jadwal";
import {
  LABEL_ALASAN_IZIN,
  LABEL_HUBUNGAN,
  LABEL_PENDIDIKAN,
  LABEL_STATUS_ABSENSI,
  LABEL_STATUS_PERNIKAHAN,
  labelSekolah,
} from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

/** Satu pilihan wilayah cadangan: "desa" (seluruh desa) atau id kelompok. */
export type WilayahCadangan = { nilai: string; nama: string; kelompokId: string | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Wilayah yang boleh diunduh admin ini (izin `cadangan.unduh`: penugasan desa
 * → seluruh desa & tiap kelompok; penugasan kelompok → kelompoknya). Batas
 * sebenarnya tetap RLS (isi file & catatan unduhan).
 */
export async function getWilayahCadangan(): Promise<{ admin: AdminSaatIni; pilihan: WilayahCadangan[] } | null> {
  const admin = await getAdminSaatIni();
  if (!admin) return null;
  const wilayah = admin.izinWilayah["cadangan.unduh"] ?? [];
  if (!wilayah.length) return { admin, pilihan: [] };
  const supabase = await createClient();
  const { data: kelompok } = await supabase.from("kelompok").select("id, nama, nomor").order("nomor");
  const desa = wilayah.includes(null);
  const pilihan: WilayahCadangan[] = [
    ...(desa ? [{ nilai: "desa", nama: "Seluruh desa", kelompokId: null }] : []),
    ...(kelompok ?? [])
      .filter((k) => desa || wilayah.includes(k.id))
      .map((k) => ({ nilai: k.id, nama: k.nama, kelompokId: k.id })),
  ];
  return { admin, pilihan };
}

/** Ambil semua baris (melewati batas 1.000 baris per permintaan). */
async function semua<T>(ambil: (dari: number, sampai: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const hasil: T[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await ambil(dari, dari + 999);
    if (error) throw new Error("Gagal membaca data cadangan");
    hasil.push(...(data ?? []));
    if (!data || data.length < 1000) return hasil;
  }
}

type BarisJamaah = {
  id: string;
  kode: string;
  kelompok_id: string;
  keluarga_id: string | null;
  hubungan_keluarga: string | null;
  nama_lengkap: string;
  nama_panggilan: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  usia: number | null;
  jenis_kelamin: string;
  status_pernikahan: string | null;
  status_sekolah: string | null;
  kelas: number | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  muballigh: boolean | null;
  kategori_jamaah_nama: string | null;
  aktif: boolean;
};

const KOP = "Desa Kartika Wanasari · KawanKu";

/** Lembar data: kop di baris 1, judul kolom di baris 3 (dibekukan & bisa disaring). */
function lembar(buku: ExcelJS.Workbook, nama: string, kolom: { judul: string; lebar: number }[], baris: unknown[][]) {
  const ws = buku.addWorksheet(nama, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = kolom.map((k) => ({ width: k.lebar }));
  ws.getCell("A1").value = `${KOP} · ${nama}`;
  ws.getCell("A1").font = { bold: true, size: 12 };
  const kepala = ws.getRow(3);
  kepala.values = kolom.map((k) => k.judul);
  kepala.font = { bold: true };
  kepala.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF8" } };
    c.border = { bottom: { style: "thin" } };
  });
  for (const b of baris) ws.addRow(b);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: kolom.length } };
  return ws;
}

const LABEL_JALUR: Record<string, string> = { kartu: "Kartu QR", layar: "QR layar", manual: "Manual" };
const ya = (v: boolean | null | undefined) => (v ? "Ya" : "Tidak");
const jk = (v: string) => (v === "P" ? "Perempuan" : "Laki-laki");
const tanggal = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);

/**
 * Buat buku Excel cadangan untuk satu wilayah (kelompokId null = seluruh
 * desa). Semua data dibaca dengan sesi pengguna (RLS), tanpa NIK/No. KK.
 * Mengembalikan file & jumlah baris per lembar (untuk catatan unduhan).
 */
export async function buatCadangan(
  supabase: Supabase,
  wilayah: WilayahCadangan,
  oleh: string,
): Promise<{ file: Buffer; ringkasan: Record<string, number> }> {
  const k = wilayah.kelompokId;
  const { data: kelompok } = await supabase.from("kelompok").select("id, nama");
  const namaKelompok = new Map((kelompok ?? []).map((x) => [x.id, x.nama as string]));

  const jamaah = await semua<BarisJamaah>((a, b) => {
    let q = supabase
      .from("jamaah_dengan_kategori")
      .select(
        "id, kode, kelompok_id, keluarga_id, hubungan_keluarga, nama_lengkap, nama_panggilan, tempat_lahir, tanggal_lahir, tahun_lahir, usia, jenis_kelamin, status_pernikahan, status_sekolah, kelas, pendidikan_terakhir, kegiatan, muballigh, kategori_jamaah_nama, aktif",
      )
      .order("kode")
      .range(a, b);
    if (k) q = q.eq("kelompok_id", k);
    return q.returns<BarisJamaah[]>();
  });
  const idJamaah = new Set(jamaah.map((j) => j.id));
  const petaJamaah = new Map(jamaah.map((j) => [j.id, j]));

  const [kontak, pribadi, keluarga, kegiatan, jadwal, absensi] = await Promise.all([
    semua<{ jamaah_id: string; no_hp: string | null; no_hp_wali: string | null; email: string | null }>((a, b) =>
      supabase.from("jamaah_kontak").select("jamaah_id, no_hp, no_hp_wali, email").range(a, b),
    ),
    semua<Record<string, string | number | boolean | null>>((a, b) =>
      supabase
        .from("jamaah_pribadi")
        .select(
          "jamaah_id, nama_ayah, nama_ibu, ktp_jalan, ktp_rt, ktp_rw, ktp_wilayah, ktp_kode_pos, domisili_sama_ktp, dom_jalan, dom_rt, dom_rw, dom_wilayah, dom_kode_pos",
        )
        .range(a, b),
    ),
    semua<{ id: string; nama: string; kelompok_id: string }>((a, b) => {
      let q = supabase.from("keluarga").select("id, nama, kelompok_id").order("nama").range(a, b);
      if (k) q = q.eq("kelompok_id", k);
      return q;
    }),
    semua<{
      id: string;
      nama: string;
      jenis: string;
      kelompok_id: string | null;
      hanya_generus: boolean;
      durasi_menit: number;
      jendela_menit: number;
      lokasi: string | null;
      aktif: boolean;
    }>((a, b) => {
      let q = supabase
        .from("kegiatan")
        .select("id, nama, jenis, kelompok_id, hanya_generus, durasi_menit, jendela_menit, lokasi, aktif")
        .order("nama")
        .range(a, b);
      if (k) q = q.or(`kelompok_id.eq.${k},kelompok_id.is.null`);
      return q;
    }),
    semua<Jadwal>((a, b) => supabase.from("kegiatan_jadwal").select("id, kegiatan_id, hari, jam, kecuali_pekan_ke").range(a, b)),
    semua<{
      jamaah_id: string;
      status: string;
      alasan_izin: string | null;
      jalur: string | null;
      sesi: { nama: string; mulai: string } | null;
    }>((a, b) =>
      supabase
        .from("absensi")
        .select("jamaah_id, status, alasan_izin, jalur, sesi:sesi_id(nama, mulai)")
        .order("dicatat_at")
        .range(a, b)
        .returns<
          {
            jamaah_id: string;
            status: string;
            alasan_izin: string | null;
            jalur: string | null;
            sesi: { nama: string; mulai: string } | null;
          }[]
        >(),
    ),
  ]);

  const kontakIni = kontak.filter((x) => idJamaah.has(x.jamaah_id));
  const pribadiIni = pribadi.filter((x) => idJamaah.has(String(x.jamaah_id)));
  const absensiIni = absensi
    .filter((x) => idJamaah.has(x.jamaah_id) && x.sesi)
    .sort((x, y) => x.sesi!.mulai.localeCompare(y.sesi!.mulai));
  const namaKeluarga = new Map(keluarga.map((x) => [x.id, x.nama]));
  const anggota = new Map<string, number>();
  for (const j of jamaah) if (j.keluarga_id) anggota.set(j.keluarga_id, (anggota.get(j.keluarga_id) ?? 0) + 1);

  const buku = new ExcelJS.Workbook();
  buku.creator = "KawanKu";
  buku.created = new Date();

  const ringkasan: Record<string, number> = {
    jamaah: jamaah.length,
    kontak: kontakIni.length,
    alamat: pribadiIni.length,
    keluarga: keluarga.length,
    kegiatan: kegiatan.length,
    absensi: absensiIni.length,
  };

  // Lembar Info: kop & keterangan.
  const info = buku.addWorksheet("Info");
  info.columns = [{ width: 28 }, { width: 60 }];
  const isiInfo: [string, string | number][] = [
    [KOP, ""],
    ["Cadangan data", wilayah.nama],
    ["Diunduh", tanggalJam(new Date().toISOString())],
    ["Oleh", oleh],
    ["", ""],
    ["Catatan", "Tanpa NIK/No. KK. Berisi data pribadi jamaah: simpan dengan amanah, jangan disebarkan."],
    ["", ""],
    ["Jamaah", ringkasan.jamaah],
    ["Kontak", ringkasan.kontak],
    ["Alamat & orang tua", ringkasan.alamat],
    ["Keluarga", ringkasan.keluarga],
    ["Kegiatan", ringkasan.kegiatan],
    ["Absensi", ringkasan.absensi],
  ];
  isiInfo.forEach((r) => info.addRow(r));
  info.getCell("A1").font = { bold: true, size: 14 };
  info.getColumn(1).font = { bold: true };

  lembar(
    buku,
    "Jamaah",
    [
      { judul: "Kode", lebar: 12 },
      { judul: "Nama lengkap", lebar: 28 },
      { judul: "Nama panggilan", lebar: 16 },
      { judul: "Kelompok", lebar: 14 },
      { judul: "Jenis kelamin", lebar: 13 },
      { judul: "Tempat lahir", lebar: 16 },
      { judul: "Tanggal lahir", lebar: 13 },
      { judul: "Tahun lahir", lebar: 11 },
      { judul: "Usia", lebar: 7 },
      { judul: "Kategori", lebar: 16 },
      { judul: "Status pernikahan", lebar: 16 },
      { judul: "Sekolah", lebar: 18 },
      { judul: "Pendidikan terakhir", lebar: 18 },
      { judul: "Pekerjaan/kegiatan", lebar: 20 },
      { judul: "Muballigh/ot", lebar: 12 },
      { judul: "Keluarga", lebar: 20 },
      { judul: "Hubungan", lebar: 18 },
      { judul: "Aktif", lebar: 8 },
    ],
    jamaah.map((j) => [
      j.kode,
      j.nama_lengkap,
      j.nama_panggilan,
      namaKelompok.get(j.kelompok_id) ?? "",
      jk(j.jenis_kelamin),
      j.tempat_lahir,
      tanggal(j.tanggal_lahir),
      j.tahun_lahir,
      j.usia,
      j.kategori_jamaah_nama,
      j.status_pernikahan ? LABEL_STATUS_PERNIKAHAN[j.status_pernikahan] : null,
      j.status_sekolah ? labelSekolah(j.status_sekolah, j.kelas) : null,
      j.pendidikan_terakhir ? (LABEL_PENDIDIKAN[j.pendidikan_terakhir] ?? j.pendidikan_terakhir) : null,
      j.kegiatan,
      ya(j.muballigh),
      j.keluarga_id ? (namaKeluarga.get(j.keluarga_id) ?? "") : null,
      j.hubungan_keluarga ? (LABEL_HUBUNGAN[j.hubungan_keluarga] ?? j.hubungan_keluarga) : null,
      ya(j.aktif),
    ]),
  ).getColumn(7).numFmt = "dd/mm/yyyy";

  const kodeNama = (id: string) => {
    const j = petaJamaah.get(id);
    return [j?.kode ?? "", j?.nama_lengkap ?? ""];
  };
  lembar(
    buku,
    "Kontak",
    [
      { judul: "Kode", lebar: 12 },
      { judul: "Nama lengkap", lebar: 28 },
      { judul: "No. HP", lebar: 16 },
      { judul: "No. HP wali", lebar: 16 },
      { judul: "Email", lebar: 28 },
    ],
    kontakIni.map((x) => [...kodeNama(x.jamaah_id), x.no_hp, x.no_hp_wali, x.email]),
  );
  lembar(
    buku,
    "Alamat & orang tua",
    [
      { judul: "Kode", lebar: 12 },
      { judul: "Nama lengkap", lebar: 28 },
      { judul: "Nama ayah", lebar: 22 },
      { judul: "Nama ibu", lebar: 22 },
      { judul: "Alamat KTP/KIA", lebar: 30 },
      { judul: "RT", lebar: 6 },
      { judul: "RW", lebar: 6 },
      { judul: "Wilayah KTP/KIA", lebar: 40 },
      { judul: "Kode pos", lebar: 9 },
      { judul: "Domisili sama", lebar: 13 },
      { judul: "Alamat domisili", lebar: 30 },
      { judul: "RT", lebar: 6 },
      { judul: "RW", lebar: 6 },
      { judul: "Wilayah domisili", lebar: 40 },
      { judul: "Kode pos", lebar: 9 },
    ],
    pribadiIni.map((x) => [
      ...kodeNama(String(x.jamaah_id)),
      x.nama_ayah,
      x.nama_ibu,
      x.ktp_jalan,
      x.ktp_rt,
      x.ktp_rw,
      x.ktp_wilayah,
      x.ktp_kode_pos,
      ya(Boolean(x.domisili_sama_ktp)),
      x.dom_jalan,
      x.dom_rt,
      x.dom_rw,
      x.dom_wilayah,
      x.dom_kode_pos,
    ]),
  );
  lembar(
    buku,
    "Keluarga",
    [
      { judul: "Nama keluarga", lebar: 28 },
      { judul: "Kelompok", lebar: 14 },
      { judul: "Jumlah anggota", lebar: 15 },
    ],
    keluarga.map((x) => [x.nama, namaKelompok.get(x.kelompok_id) ?? "", anggota.get(x.id) ?? 0]),
  );
  const jadwalPer = new Map<string, Jadwal[]>();
  for (const j of jadwal) jadwalPer.set(j.kegiatan_id, [...(jadwalPer.get(j.kegiatan_id) ?? []), j]);
  lembar(
    buku,
    "Kegiatan",
    [
      { judul: "Nama kegiatan", lebar: 30 },
      { judul: "Jenis", lebar: 10 },
      { judul: "Wilayah", lebar: 14 },
      { judul: "Peserta", lebar: 14 },
      { judul: "Jadwal", lebar: 40 },
      { judul: "Durasi (menit)", lebar: 14 },
      { judul: "Absensi terbuka (menit)", lebar: 22 },
      { judul: "Lokasi", lebar: 22 },
      { judul: "Aktif", lebar: 8 },
    ],
    kegiatan.map((x) => [
      x.nama,
      x.jenis === "agenda" ? "Agenda" : "Rutin",
      x.kelompok_id ? (namaKelompok.get(x.kelompok_id) ?? "") : "Tingkat desa",
      x.hanya_generus ? "Generus" : "Semua jamaah",
      ringkasJadwal(jadwalPer.get(x.id) ?? []),
      x.durasi_menit,
      x.jendela_menit,
      x.lokasi,
      ya(x.aktif),
    ]),
  );
  lembar(
    buku,
    "Absensi",
    [
      { judul: "Waktu pertemuan", lebar: 22 },
      { judul: "Pertemuan", lebar: 30 },
      { judul: "Kode", lebar: 12 },
      { judul: "Nama lengkap", lebar: 28 },
      { judul: "Kelompok", lebar: 14 },
      { judul: "Status", lebar: 10 },
      { judul: "Alasan izin", lebar: 12 },
      { judul: "Jalur", lebar: 10 },
    ],
    absensiIni.map((x) => {
      const j = petaJamaah.get(x.jamaah_id);
      return [
        tanggalJam(x.sesi!.mulai),
        x.sesi!.nama,
        j?.kode ?? "",
        j?.nama_lengkap ?? "",
        j ? (namaKelompok.get(j.kelompok_id) ?? "") : "",
        LABEL_STATUS_ABSENSI[x.status] ?? x.status,
        x.alasan_izin ? (LABEL_ALASAN_IZIN[x.alasan_izin] ?? x.alasan_izin) : null,
        x.jalur ? (LABEL_JALUR[x.jalur] ?? x.jalur) : null,
      ];
    }),
  );

  const file = Buffer.from(await buku.xlsx.writeBuffer());
  return { file, ringkasan };
}
