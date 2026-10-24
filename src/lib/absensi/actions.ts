"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  bolehCatatSesi,
  bolehKelolaSesi,
  getAksesAbsensi,
  KOLOM_SESI,
  type Sesi,
} from "@/lib/absensi/akses";
import { bacaPengaturanAbsensi } from "@/lib/absensi/pengaturan";
import { LABEL_ALASAN_IZIN } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";
import { dariInputWib } from "@/lib/waktu";

const TIDAK_BERHAK: StateAksi = { galat: "Kamu tidak punya izin untuk tindakan ini." };
const GAGAL: StateAksi = { galat: "Gagal menyimpan. Coba lagi." };

async function konteks() {
  const akses = await getAksesAbsensi();
  if (!akses || akses.kelompokKelola.length === 0) return null;
  return { akses, supabase: await createClient() };
}

async function bacaSesi(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("sesi_absensi").select(KOLOM_SESI).eq("id", id).maybeSingle<Sesi>();
  return data;
}

/**
 * Acara di luar jadwal: dibuat sebagai agenda sekali di Kegiatan sekaligus
 * dibuka absensinya (RPC buat_acara_absensi), supaya setiap absensi selalu
 * punya kegiatannya.
 */
export async function buatAcara(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const nama = String(formData.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return { galat: "Isi nama acara, mis. Kerja bakti masjid." };
  if (nama.length > 120) return { galat: "Nama acara maksimal 120 karakter." };
  const mulai = dariInputWib(String(formData.get("mulai") ?? ""));
  if (!mulai) return { galat: "Isi tanggal dan jam mulai." };
  const durasi = Math.min(720, Math.max(15, Number(formData.get("durasi")) || 90));
  const wilayah = String(formData.get("wilayah") ?? "");
  const kelompokId = wilayah === "desa" ? null : wilayah;
  const target = ctx.akses.targetSesi.find((t) => t.kelompokId === kelompokId);
  if (!target) return { galat: "Pilih wilayah acara." };
  const hanyaGenerus = !target.umum || formData.get("sasaran") === "generus";
  const atur = bacaPengaturanAbsensi(formData);

  const { data, error } = await ctx.supabase.rpc("buat_acara_absensi", {
    p_nama: nama,
    p_kelompok_id: kelompokId,
    p_hanya_generus: hanyaGenerus,
    p_mulai: mulai,
    p_durasi_menit: durasi,
    p_absensi_otomatis: atur.absensi_otomatis,
    p_buka_sebelum_menit: atur.buka_sebelum_menit,
    p_tutup_setelah_menit: atur.tutup_setelah_menit,
  });
  if (error?.hint === "belum_waktunya") {
    return {
      galat:
        "Absensi baru bisa dibuka paling cepat 2 jam sebelum mulai. Untuk acara yang masih lama, buat agenda di Kegiatan; absensinya dibuka di hari-H.",
    };
  }
  if (error?.code === "42501") {
    return { galat: "Kamu belum berwenang membuat kegiatan di wilayah ini. Minta admin desa menambahkan izin Kegiatan." };
  }
  if (error || !data) return GAGAL;
  redirect(`/absensi/${data}`);
}

/**
 * Buka / tutup absensi dari halaman sesi:
 * - "buka": scan diterima sekarang juga sampai ditutup (tanpa melihat jam);
 * - "tutup": scan ditolak;
 * - "otomatis": ikuti jam buka/tutup otomatis kegiatannya lagi.
 */
export async function aturBukaSesi(id: string, mode: "buka" | "tutup" | "otomatis"): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const sesi = await bacaSesi(ctx.supabase, id);
  if (!sesi || !bolehKelolaSesi(ctx.akses, sesi)) return TIDAK_BERHAK;
  if (mode === "otomatis" && !sesi.buka_otomatis) return { galat: "Kegiatan ini memakai buka/tutup manual." };
  const isi =
    mode === "buka"
      ? { ditutup: false, dibuka_manual: true }
      : mode === "tutup"
        ? { ditutup: true, dibuka_manual: false }
        : { ditutup: false, dibuka_manual: false };
  const { error } = await ctx.supabase.from("sesi_absensi").update(isi).eq("id", id);
  if (error) return GAGAL;
  refresh();
  return {};
}

export async function hapusSesi(id: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const sesi = await bacaSesi(ctx.supabase, id);
  if (!sesi || !bolehKelolaSesi(ctx.akses, sesi)) return TIDAK_BERHAK;
  // Pertemuannya di Kegiatan tetap ada; absensinya bisa dibuka lagi dari sana.
  const { error, count } = await ctx.supabase.from("sesi_absensi").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return GAGAL;
  redirect("/absensi");
}

// ---------------------------------------------------------------------
// Pencatatan
// ---------------------------------------------------------------------

export type HasilScan = {
  hasil:
    | "tercatat"
    | "sudah"
    | "tidak_dikenal"
    | "kartu_dicabut"
    | "pakai_akun"
    | "sesi_ditutup"
    | "belum_waktunya"
    | "lewat_waktu"
    | "bukan_peserta"
    | "jamaah_nonaktif"
    | "tidak_berhak"
    | "galat";
  nama?: string;
  kode?: string;
  kelompok?: string;
  /** Jenis kelamin jamaah (untuk ucapan syukur). */
  jenisKelamin?: "L" | "P";
  /** Penanda keringanan (hanya bila admin boleh melihatnya). */
  keringanan?: boolean;
  /** Waktu tercatat (scan pertama); untuk hasil "sudah". */
  dicatatAt?: string;
};

/** Catat kehadiran dari hasil scan kartu (token) atau ketikan kode KW-. */
export async function catatKode(sesiId: string, kode: string): Promise<HasilScan> {
  const ctx = await konteks();
  if (!ctx) return { hasil: "tidak_berhak" };
  const bersih = kode.trim().slice(0, 40);
  if (!bersih) return { hasil: "tidak_dikenal" };

  const { data, error } = await ctx.supabase.rpc("catat_absensi_kode", { p_sesi_id: sesiId, p_kode: bersih });
  if (error || !data) return { hasil: "galat" };
  const r = data as { hasil: HasilScan["hasil"]; jamaah_id?: string };
  const hasil: HasilScan = { hasil: r.hasil };

  if (r.jamaah_id) {
    const [{ data: j }, { data: k }, { data: a }] = await Promise.all([
      ctx.supabase
        .from("jamaah")
        .select("nama_lengkap, kode, jenis_kelamin, kelompok:kelompok_id(nama)")
        .eq("id", r.jamaah_id)
        .maybeSingle<{ nama_lengkap: string; kode: string; jenis_kelamin: "L" | "P"; kelompok: { nama: string } | null }>(),
      ctx.akses.bolehLihatKeringanan
        ? ctx.supabase.from("jamaah_keringanan").select("aktif").eq("jamaah_id", r.jamaah_id).maybeSingle()
        : Promise.resolve({ data: null }),
      r.hasil === "sudah"
        ? ctx.supabase
            .from("absensi")
            .select("dicatat_at")
            .eq("sesi_id", sesiId)
            .eq("jamaah_id", r.jamaah_id)
            .maybeSingle<{ dicatat_at: string }>()
        : Promise.resolve({ data: null }),
    ]);
    if (j) {
      hasil.nama = j.nama_lengkap;
      hasil.kode = j.kode;
      hasil.kelompok = j.kelompok?.nama;
      hasil.jenisKelamin = j.jenis_kelamin;
    }
    hasil.keringanan = Boolean(k?.aktif);
    if (a) hasil.dicatatAt = a.dicatat_at;
  }
  if (hasil.hasil === "tercatat") refresh();
  return hasil;
}

/**
 * Ubah status satu peserta dari daftar rekap. Nilai: "" (hapus catatan),
 * "hadir", "sakit", atau "izin:<alasan>".
 */
export async function ubahStatusPeserta(
  sesiId: string,
  jamaahId: string,
  _prev: StateAksi,
  formData: FormData,
): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const sesi = await bacaSesi(ctx.supabase, sesiId);
  if (!sesi || !bolehCatatSesi(ctx.akses, sesi)) return TIDAK_BERHAK;

  const nilai = String(formData.get("status") ?? "");
  if (nilai === "") {
    const { error } = await ctx.supabase.from("absensi").delete().eq("sesi_id", sesiId).eq("jamaah_id", jamaahId);
    if (error) return GAGAL;
    refresh();
    return {};
  }

  const [status, alasan] = nilai.split(":");
  if (!["hadir", "izin", "sakit"].includes(status)) return { galat: "Pilih status." };
  if (status === "izin" && !(alasan in LABEL_ALASAN_IZIN)) return { galat: "Pilih alasan izin." };
  const { error } = await ctx.supabase.from("absensi").upsert(
    {
      sesi_id: sesiId,
      jamaah_id: jamaahId,
      status,
      alasan_izin: status === "izin" ? alasan : null,
      jalur: "manual",
      dicatat_at: new Date().toISOString(),
    },
    { onConflict: "sesi_id,jamaah_id" },
  );
  if (error) {
    return error.message.includes("bukan peserta")
      ? { galat: "Jamaah ini bukan peserta sesi." }
      : error.message.includes("tidak aktif")
        ? { galat: "Jamaah tidak aktif." }
        : GAGAL;
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------
// Kartu QR
// ---------------------------------------------------------------------

export async function buatKartuKelompok(kelompokId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx || !ctx.akses.kelompokKelola.some((k) => k.id === kelompokId)) return TIDAK_BERHAK;
  const { data, error } = await ctx.supabase.rpc("buat_kartu_qr_kelompok", { p_kelompok_id: kelompokId });
  if (error) return GAGAL;
  refresh();
  return { pesan: data ? `${data} kartu baru dibuat.` : "Semua jamaah aktif sudah punya kartu." };
}

/** Kartu pertama, atau ganti kartu yang hilang/rusak (kartu lama tidak berlaku lagi). */
export async function gantiKartu(jamaahId: string): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const { error } = await ctx.supabase.rpc("ganti_kartu_qr", { p_jamaah_id: jamaahId });
  if (error?.hint === "pakai_akun") {
    return { galat: "Generus absen lewat akunnya (scan QR layar). Kartu fisik hanya untuk yang berpenanda keringanan." };
  }
  if (error) return GAGAL;
  refresh();
  return { pesan: "Kartu baru dibuat. Kartu lama tidak berlaku lagi." };
}

/** Setujui / tolak pengajuan izin generus (status dari tombol yang ditekan). */
export async function tanganiPengajuanIzin(id: string, _prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const ctx = await konteks();
  if (!ctx) return TIDAK_BERHAK;
  const status = formData.get("status");
  if (status !== "disetujui" && status !== "ditolak") return GAGAL;
  const tanggapan = String(formData.get("tanggapan") ?? "").trim().replace(/\s+/g, " ");
  if (tanggapan.length > 200) return { galat: "Tanggapan maksimal 200 karakter." };
  const { data, error } = await ctx.supabase
    .from("pengajuan_izin")
    .update({ status, tanggapan: tanggapan || null })
    .eq("id", id)
    .eq("status", "menunggu")
    .select("id");
  if (error || !data?.length) return { galat: "Pengajuan ini sudah ditangani atau di luar wewenangmu." };
  refresh();
  return { pesan: status === "disetujui" ? "Disetujui." : "Ditolak." };
}

/** Token QR layar terbaru (berganti tiap 60 detik, berlaku 90 detik) + jumlah hadir. */
/** Jumlah hadir sesi untuk layar QR (tanpa membuat token baru). */
export async function hadirLayar(sesiId: string): Promise<number | null> {
  const akses = await getAksesAbsensi();
  if (!akses || akses.kelompokKelola.length === 0) return null;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("absensi")
    .select("id", { count: "exact", head: true })
    .eq("sesi_id", sesiId)
    .eq("status", "hadir");
  return error ? null : (count ?? 0);
}

export async function tokenLayar(sesiId: string): Promise<{ token: string | null; hadir: number } | null> {
  const akses = await getAksesAbsensi();
  if (!akses || akses.kelompokKelola.length === 0) return null;
  const supabase = await createClient();
  const [{ data: token, error }, { count }] = await Promise.all([
    supabase.rpc("token_layar", { p_sesi_id: sesiId }),
    supabase
      .from("absensi")
      .select("id", { count: "exact", head: true })
      .eq("sesi_id", sesiId)
      .eq("status", "hadir"),
  ]);
  if (error) return null;
  return { token: (token as string | null) ?? null, hadir: count ?? 0 };
}
