"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { KOLOM_KEGIATAN } from "@/lib/kegiatan/data";
import type { Kegiatan } from "@/lib/kegiatan/jadwal";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";
import { dariInputWib } from "@/lib/waktu";

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };

async function konteks() {
  const akses = await getAksesKegiatan();
  if (!akses || akses.targetKegiatan.length === 0) return null;
  return { akses, supabase: await createClient() };
}

const teks = (fd: FormData, k: string, maks: number) => {
  const v = String(fd.get(k) ?? "").trim().replace(/\s+/g, " ");
  return v ? v.slice(0, maks) : null;
};

type BarisJadwal = { hari: number; jam: string; kecuali_pekan_ke: number[] };

/** Baris jadwal dari form: hari_i, jam_i, libur_i (pekan, dipisah koma). */
function bacaJadwal(fd: FormData): BarisJadwal[] | { galat: string } {
  const hasil: BarisJadwal[] = [];
  for (let i = 0; i < 7; i++) {
    const hari = fd.get(`hari_${i}`);
    if (hari === null || hari === "") continue;
    const jam = String(fd.get(`jam_${i}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(jam)) return { galat: "Isi jam untuk setiap hari jadwal." };
    const libur = fd
      .getAll(`libur_${i}`)
      .map(Number)
      .filter((n) => n >= 1 && n <= 5);
    hasil.push({ hari: Number(hari), jam, kecuali_pekan_ke: [...new Set(libur)].sort() });
  }
  const unik = new Set(hasil.map((j) => `${j.hari}-${j.jam}`));
  if (unik.size !== hasil.length) return { galat: "Ada hari & jam jadwal yang sama dua kali." };
  return hasil;
}

export async function buatKegiatan(_prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const nama = teks(fd, "nama", 120);
  if (!nama) return { galat: "Isi nama kegiatan." };
  const jenis = fd.get("jenis") === "agenda" ? "agenda" : "rutin";
  const target = ctx.akses.targetKegiatan.find((t) => t.nilai === fd.get("wilayah"));
  if (!target) return { galat: "Pilih wilayah kegiatan." };
  if (jenis === "agenda" && target.nilai === "serentak") {
    return { galat: "Agenda sekali jalan dibuat per kelompok atau tingkat desa, bukan serentak." };
  }
  const hanyaGenerus = !target.umum || fd.get("sasaran") === "generus";
  const durasi = Math.min(720, Math.max(15, Number(fd.get("durasi")) || 90));

  let jadwal: BarisJadwal[] = [];
  let mulaiAgenda: string | null = null;
  if (jenis === "rutin") {
    const j = bacaJadwal(fd);
    if ("galat" in j) return j;
    if (j.length === 0) return { galat: "Tambahkan minimal satu hari jadwal." };
    jadwal = j;
  } else {
    mulaiAgenda = dariInputWib(String(fd.get("mulai") ?? ""));
    if (!mulaiAgenda) return { galat: "Isi tanggal dan jam agenda." };
  }

  const { data: k, error } = await ctx.supabase
    .from("kegiatan")
    .insert({
      nama,
      jenis,
      kelompok_id: target.nilai === "desa" || target.nilai === "serentak" ? null : target.nilai,
      per_kelompok: target.nilai === "serentak",
      hanya_generus: hanyaGenerus,
      lokasi: teks(fd, "lokasi", 120),
      keterangan: teks(fd, "keterangan", 500),
      durasi_menit: durasi,
    })
    .select("id, kelompok_id")
    .maybeSingle();
  if (error || !k) return GAGAL;

  const lanjut =
    jenis === "rutin"
      ? await ctx.supabase.from("kegiatan_jadwal").insert(jadwal.map((j) => ({ ...j, kegiatan_id: k.id })))
      : await ctx.supabase.from("pertemuan").insert({
          kegiatan_id: k.id,
          kelompok_id: k.kelompok_id,
          tanggal: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date(mulaiAgenda!)),
          mulai: mulaiAgenda,
        });
  if (lanjut.error) {
    await ctx.supabase.from("kegiatan").delete().eq("id", k.id);
    return GAGAL;
  }
  redirect(`/kegiatan/kelola/${k.id}`);
}

async function bacaKegiatan(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("kegiatan").select(KOLOM_KEGIATAN).eq("id", id).maybeSingle<Kegiatan>();
  return data;
}

export async function ubahKegiatan(id: string, _prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const nama = teks(fd, "nama", 120);
  if (!nama) return { galat: "Isi nama kegiatan." };
  const { error, count } = await ctx.supabase
    .from("kegiatan")
    .update(
      {
        nama,
        lokasi: teks(fd, "lokasi", 120),
        keterangan: teks(fd, "keterangan", 500),
        durasi_menit: Math.min(720, Math.max(15, Number(fd.get("durasi")) || 90)),
        aktif: fd.get("aktif") === "on",
      },
      { count: "exact" },
    )
    .eq("id", id);
  if (error || !count) return error ? GAGAL : TIDAK_BERHAK;
  refresh();
  return { pesan: "Tersimpan." };
}

/** Ganti seluruh aturan jadwal (mis. hasil musyawarah). Pertemuan lama yang tersimpan tetap ada. */
export async function simpanJadwal(id: string, _prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const k = await bacaKegiatan(ctx.supabase, id);
  if (!k || k.jenis !== "rutin") return TIDAK_BERHAK;
  const jadwal = bacaJadwal(fd);
  if ("galat" in jadwal) return jadwal;
  if (jadwal.length === 0) return { galat: "Tambahkan minimal satu hari jadwal (atau nonaktifkan kegiatannya)." };
  const hapus = await ctx.supabase.from("kegiatan_jadwal").delete({ count: "exact" }).eq("kegiatan_id", id);
  if (hapus.error) return GAGAL;
  const { error } = await ctx.supabase.from("kegiatan_jadwal").insert(jadwal.map((j) => ({ ...j, kegiatan_id: id })));
  if (error) return GAGAL;
  refresh();
  return { pesan: "Jadwal tersimpan. Kalender langsung mengikuti jadwal baru." };
}

export async function hapusKegiatan(id: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { error, count } = await ctx.supabase.from("kegiatan").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return error ? GAGAL : TIDAK_BERHAK;
  redirect("/kegiatan/kelola");
}

// ---------------------------------------------------------------------
// Pertemuan
// ---------------------------------------------------------------------

type KunciPertemuan = { kegiatanId: string; kelompokId: string | null; tanggal: string; mulaiJadwal: string };

/** Perbarui pertemuan bila sudah tersimpan; bila belum, buat dari waktu jadwal. */
async function simpan(k: KunciPertemuan, isi: Record<string, unknown>) {
  const supabase = await createClient();
  const kegiatan = await bacaKegiatan(supabase, k.kegiatanId);
  if (!kegiatan) return { error: true };
  const kelompokId = kegiatan.per_kelompok ? k.kelompokId : kegiatan.kelompok_id;
  let q = supabase.from("pertemuan").select("id").eq("kegiatan_id", k.kegiatanId).eq("tanggal", k.tanggal);
  q = kelompokId ? q.eq("kelompok_id", kelompokId) : q.is("kelompok_id", null);
  const { data: ada } = await q.maybeSingle();
  const { error } = ada
    ? await supabase.from("pertemuan").update(isi).eq("id", ada.id)
    : await supabase
        .from("pertemuan")
        .insert({ kegiatan_id: k.kegiatanId, kelompok_id: kelompokId, tanggal: k.tanggal, mulai: k.mulaiJadwal, ...isi });
  return { error: Boolean(error) };
}

/** Isi pemateri, materi, catatan, dan (opsional) pindah waktu. */
export async function simpanPertemuan(k: KunciPertemuan, _prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const pilih = String(fd.get("pemateri_id") ?? "");
  let pemateriId: string | null = null;
  let pemateriNama = teks(fd, "pemateri_nama", 120);
  if (pilih && pilih !== "lain") {
    const { data: j } = await ctx.supabase.from("jamaah").select("id, nama_lengkap").eq("id", pilih).maybeSingle();
    if (j) {
      pemateriId = j.id;
      pemateriNama = j.nama_lengkap;
    }
  }
  const isiMulai = String(fd.get("mulai") ?? "");
  const mulai = isiMulai ? dariInputWib(isiMulai) : k.mulaiJadwal;
  if (!mulai) return { galat: "Waktu pertemuan tidak valid." };
  const { error } = await simpan(k, {
    pemateri_jamaah_id: pemateriId,
    pemateri_nama: pemateriNama,
    materi: teks(fd, "materi", 300),
    catatan: teks(fd, "catatan", 1000),
    mulai,
  });
  if (error) return GAGAL;
  refresh();
  return { pesan: "Tersimpan." };
}

export async function batalkanPertemuan(k: KunciPertemuan, _prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const alasan = teks(fd, "alasan", 200);
  if (!alasan) return { galat: "Isi alasan, mis. libur Hari Keluarga atau hasil musyawarah." };
  const { error } = await simpan(k, { status: "dibatalkan", alasan_batal: alasan });
  if (error) return GAGAL;
  refresh();
  return { pesan: "Pertemuan ditandai batal/libur." };
}

export async function aktifkanPertemuan(k: KunciPertemuan): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await simpan(k, { status: "terjadwal", alasan_batal: null });
  if (error) return GAGAL;
  refresh();
  return {};
}

/** Buat (bila belum) sesi absensi untuk pertemuan ini, lalu buka halamannya. */
export async function bukaAbsensiPertemuan(k: KunciPertemuan & { mulai: string }): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase.rpc("buka_absensi_pertemuan", {
    p_kegiatan_id: k.kegiatanId,
    p_kelompok_id: k.kelompokId,
    p_tanggal: k.tanggal,
    p_mulai: k.mulai,
  });
  if (error || !data) {
    return {
      galat: error?.message.includes("dibatalkan")
        ? "Pertemuan ini dibatalkan; aktifkan lagi dulu."
        : "Gagal membuka absensi. Pastikan kamu pengelola absensi wilayah ini.",
    };
  }
  redirect(`/absensi/${data}`);
}

// ---------------------------------------------------------------------
// Pengumuman untuk generus (pengurus kegiatan di wilayahnya; batas = RLS
// private.boleh_kelola_pengumuman)
// ---------------------------------------------------------------------

/** Wilayah pengumuman generus yang boleh dipilih: "desa" atau id kelompok. */
export async function buatPengumumanGenerus(_prev: StateAksi, fd: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const pesan = teks(fd, "pesan", 300);
  if (!pesan) return { galat: "Isi pesan pengumuman." };
  const wilayah = String(fd.get("wilayah") ?? "");
  const bolehDesa = ctx.akses.kelolaDesa && wilayah === "desa";
  if (!bolehDesa && !ctx.akses.kelompokKelola.some((k) => k.id === wilayah)) return TIDAK_BERHAK;
  const nada = fd.get("nada") === "peringatan" ? "peringatan" : "info";
  const mulaiInput = String(fd.get("mulai") ?? "");
  const berakhirInput = String(fd.get("berakhir") ?? "");
  const mulai = mulaiInput ? dariInputWib(mulaiInput) : new Date().toISOString();
  const berakhir = berakhirInput ? dariInputWib(berakhirInput) : null;
  if (!mulai || (berakhirInput && !berakhir)) return { galat: "Tanggal tidak valid." };
  if (berakhir && berakhir <= mulai) return { galat: "Waktu berakhir harus setelah waktu mulai." };

  const { error } = await ctx.supabase.from("pengumuman").insert({
    pesan,
    nada,
    mulai,
    berakhir,
    sasaran: "generus",
    kelompok_id: wilayah === "desa" ? null : wilayah,
  });
  if (error) return GAGAL;
  refresh();
  return { pesan: "Pengumuman dibuat. Generus melihatnya di berandanya." };
}

export async function ubahStatusPengumumanGenerus(id: string, aktif: boolean): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase
    .from("pengumuman")
    .update({ aktif })
    .eq("id", id)
    .eq("sasaran", "generus")
    .select("id");
  if (error || !data?.length) return GAGAL;
  refresh();
  return { pesan: aktif ? "Ditayangkan." : "Disembunyikan." };
}

export async function hapusPengumumanGenerus(id: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase
    .from("pengumuman")
    .delete()
    .eq("id", id)
    .eq("sasaran", "generus")
    .select("id");
  if (error || !data?.length) return GAGAL;
  refresh();
  return { pesan: "Dihapus." };
}
