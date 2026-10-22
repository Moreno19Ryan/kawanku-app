"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getGenerusSaatIni, pinDariTanggalLahir } from "@/lib/generus/akun";
import { tujuanGenerus } from "@/lib/generus/tujuan";
import { bacaAlamat } from "@/lib/jamaah/alamat";
import { bacaNoHp } from "@/lib/jamaah/format";
import { BAGIAN_LAPOR_GENERUS, bacaNilaiUsulan, labelNilaiUsulan } from "@/lib/jamaah/usulan-nilai";
import { hariIniWib } from "@/lib/kegiatan/jadwal";
import {
  LABEL_ALASAN_IZIN,
  LABEL_BAGIAN_USULAN,
  LABEL_PENDIDIKAN,
  LABEL_STATUS_SEKOLAH,
  RENTANG_KELAS,
  ucapanSyukur,
} from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

export async function gantiPin(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  const pin = String(formData.get("pin") ?? "").trim();
  const ulang = String(formData.get("ulang") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { galat: "PIN harus 6 angka." };
  if (pin !== ulang) return { galat: "Ulangi PIN tidak sama." };

  const supabase = await createClient();
  const { data: j } = await supabase.from("jamaah").select("tanggal_lahir").eq("id", generus.jamaah.id).maybeSingle();
  if (pin === pinDariTanggalLahir(j?.tanggal_lahir ?? null)) {
    return { galat: "Jangan pakai tanggal lahir; mudah ditebak orang lain." };
  }
  if (/^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
    return { galat: "PIN terlalu mudah ditebak (mis. 111111 atau 123456)." };
  }

  const { error } = await supabase.rpc("ganti_pin_saya", { p_pin: pin });
  if (error) {
    return { galat: error.hint === "sama" ? "PIN baru harus berbeda dari PIN lama." : "Gagal mengganti PIN. Coba lagi." };
  }
  redirect(tujuanGenerus(formData.get("tujuan")));
}

/** Generus mengubah alamatnya sendiri (KTP/KIA + domisili); nama orang tua tetap lewat admin. */
export async function simpanAlamatSaya(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  if (generus.pinAwal) return { galat: "Ganti PIN awalmu dulu sebelum mengubah alamat." };

  const ktp = bacaAlamat(formData, "ktp");
  if (typeof ktp === "string") return { galat: ktp };
  const sama = formData.get("domisili_sama_ktp") === "on";
  const dom = sama ? null : bacaAlamat(formData, "dom");
  if (typeof dom === "string") return { galat: dom };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_alamat_saya", {
    p_ktp_kode_wilayah: ktp.kode_wilayah,
    p_ktp_wilayah: ktp.wilayah,
    p_ktp_jalan: ktp.jalan,
    p_ktp_rt: ktp.rt,
    p_ktp_rw: ktp.rw,
    p_ktp_kode_pos: ktp.kode_pos,
    p_domisili_sama: sama,
    p_dom_kode_wilayah: dom?.kode_wilayah ?? null,
    p_dom_wilayah: dom?.wilayah ?? null,
    p_dom_jalan: dom?.jalan ?? null,
    p_dom_rt: dom?.rt ?? null,
    p_dom_rw: dom?.rw ?? null,
    p_dom_kode_pos: dom?.kode_pos ?? null,
  });
  if (error) return { galat: "Gagal menyimpan alamat. Coba lagi." };
  refresh();
  return { pesan: `Alamat tersimpan. ${ucapanSyukur(generus.jamaah.jenisKelamin)}.` };
}

/** Teks bebas: spasi dirapikan; terlalu panjang → pesan galat. */
function teks(formData: FormData, nama: string, maks: number, label: string): string | { galat: string } {
  const isi = String(formData.get(nama) ?? "").trim().replace(/\s+/g, " ");
  return isi.length > maks ? { galat: `${label} maksimal ${maks} karakter.` } : isi;
}

/**
 * Generus mengubah data dirinya sendiri (langsung tersimpan & tercatat di
 * jejak perubahan). Nama lengkap, jenis kelamin, status pernikahan,
 * kelompok, dan keluarga tetap lewat laporan ke admin.
 */
export async function simpanDataDiri(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  if (generus.pinAwal) return { galat: "Ganti PIN awalmu dulu." };

  const panggilan = teks(formData, "nama_panggilan", 40, "Nama panggilan");
  const tempat = teks(formData, "tempat_lahir", 80, "Tempat lahir");
  const kegiatan = teks(formData, "kegiatan", 120, "Pekerjaan/kegiatan");
  const ayah = teks(formData, "nama_ayah", 120, "Nama ayah");
  const ibu = teks(formData, "nama_ibu", 120, "Nama ibu");
  for (const t of [panggilan, tempat, kegiatan, ayah, ibu]) if (typeof t !== "string") return t;

  const tanggal = String(formData.get("tanggal_lahir") ?? "");
  if (tanggal && (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal <= "1900-01-01" || tanggal > hariIniWib())) {
    return { galat: "Isi tanggal lahir yang benar." };
  }
  const sekolah = String(formData.get("status_sekolah") ?? "");
  if (sekolah && !(sekolah in LABEL_STATUS_SEKOLAH)) return { galat: "Pilih status sekolah yang benar." };
  const rentang = RENTANG_KELAS[sekolah];
  const kelasTeks = String(formData.get("kelas") ?? "");
  const kelas = rentang && kelasTeks ? Number(kelasTeks) : null;
  if (kelas !== null && (!Number.isInteger(kelas) || kelas < rentang[0] || kelas > rentang[1])) {
    return { galat: `Kelas ${LABEL_STATUS_SEKOLAH[sekolah]} antara ${rentang[0]} dan ${rentang[1]}.` };
  }
  const pendidikan = String(formData.get("pendidikan_terakhir") ?? "");
  if (pendidikan && !(pendidikan in LABEL_PENDIDIKAN)) return { galat: "Pilih pendidikan terakhir yang benar." };

  const noHp = bacaNoHp(formData.get("no_hp"));
  if (noHp === undefined) return { galat: "No. HP harus nomor Indonesia yang valid, mis. 0812-3456-7890." };
  const noHpWali = bacaNoHp(formData.get("no_hp_wali"));
  if (noHpWali === undefined) return { galat: "No. HP wali harus nomor Indonesia yang valid." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return { galat: "Format email tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("ubah_data_diri_saya", {
    p_nama_panggilan: panggilan as string,
    p_tempat_lahir: tempat as string,
    p_tanggal_lahir: tanggal || null,
    p_status_sekolah: sekolah,
    p_kelas: kelas,
    p_pendidikan_terakhir: pendidikan,
    p_kegiatan: kegiatan as string,
    p_no_hp: noHp ?? "",
    p_email: email,
    p_no_hp_wali: noHpWali ?? "",
    p_nama_ayah: ayah as string,
    p_nama_ibu: ibu as string,
  });
  if (error?.hint === "bukan_generus_lagi") {
    return {
      galat:
        "Perubahan ini membuatmu tidak lagi termasuk generus, jadi tidak bisa disimpan sendiri. Bila datanya memang begitu, laporkan ke admin di bagian bawah.",
    };
  }
  if (error) return { galat: "Gagal menyimpan. Periksa isianmu lalu coba lagi." };
  refresh();
  return { pesan: `Data diri tersimpan. ${ucapanSyukur(generus.jamaah.jenisKelamin)}.` };
}

/** Generus melaporkan data yang salah; admin yang membetulkan. */
export async function kirimUsulanKoreksi(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  if (generus.pinAwal) return { galat: "Ganti PIN awalmu dulu." };

  const bagian = String(formData.get("bagian") ?? "");
  if (!(BAGIAN_LAPOR_GENERUS as readonly string[]).includes(bagian)) return { galat: "Pilih data yang salah." };
  const nilai = bacaNilaiUsulan(
    bagian,
    String(formData.get("nilai") ?? ""),
    String(formData.get("nilai_kelas") ?? ""),
    hariIniWib(),
  );
  if (typeof nilai === "string") return { galat: nilai };
  // Bila nilai dipilih, keterangan boleh kosong (diisi dari nilainya).
  const isi =
    String(formData.get("isi") ?? "").trim().replace(/\s+/g, " ") ||
    (nilai.nilai ? labelNilaiUsulan(bagian, nilai.nilai, nilai.nilai_kelas) : "");
  if (!isi) return { galat: "Tulis data yang benar." };
  if (isi.length > 300) return { galat: "Maksimal 300 karakter." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("usulan_koreksi")
    .insert({ jamaah_id: generus.jamaah.id, bagian, isi, ...nilai });
  if (error?.code === "23505") {
    return { galat: `Laporan "${LABEL_BAGIAN_USULAN[bagian]}" sebelumnya masih menunggu dicek admin.` };
  }
  if (error) return { galat: "Gagal mengirim. Coba lagi." };
  refresh();
  return { pesan: `Terkirim, admin kelompokmu akan mengeceknya. ${ucapanSyukur(generus.jamaah.jenisKelamin)}.` };
}

/** Batalkan laporan yang masih menunggu. */
export async function batalkanUsulanKoreksi(id: string): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("usulan_koreksi").delete().eq("id", id).select("id");
  if (error || !data?.length) return { galat: "Laporan tidak bisa dibatalkan (mungkin sudah dicek admin)." };
  refresh();
  return { pesan: "Laporan dibatalkan." };
}

const PESAN_IZIN: Record<string, string> = {
  bukan_wilayah: "Kegiatan ini bukan untuk kelompokmu.",
  tanggal: "Izin hanya bisa diajukan untuk hari ini sampai 60 hari ke depan.",
  tidak_ada_jadwal: "Tidak ada jadwal kegiatan itu pada tanggal tersebut.",
  dibatalkan: "Pertemuan ini dibatalkan, tidak perlu izin.",
  ditutup: "Absensi pertemuan ini sudah ditutup.",
};

/** Generus mengajukan izin/sakit untuk satu pertemuan; admin yang menyetujui. */
export async function ajukanIzin(_prev: StateAksi, formData: FormData): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  if (generus.pinAwal) return { galat: "Ganti PIN awalmu dulu." };

  const [kegiatanId, tanggal] = String(formData.get("kejadian") ?? "").split("|");
  if (!/^[0-9a-f-]{36}$/.test(kegiatanId ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal ?? "")) {
    return { galat: "Pilih pertemuan yang mau diizinkan." };
  }
  const jenis = formData.get("jenis");
  if (jenis !== "izin" && jenis !== "sakit") return { galat: "Pilih izin atau sakit." };
  const alasan = String(formData.get("alasan_izin") ?? "");
  if (jenis === "izin" && !(alasan in LABEL_ALASAN_IZIN)) return { galat: "Pilih alasan izin." };
  const keterangan = String(formData.get("keterangan") ?? "").trim().replace(/\s+/g, " ");
  if (keterangan.length > 150) return { galat: "Keterangan maksimal 150 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.from("pengajuan_izin").insert({
    jamaah_id: generus.jamaah.id,
    kegiatan_id: kegiatanId,
    tanggal,
    jenis,
    alasan_izin: jenis === "izin" ? alasan : null,
    keterangan: jenis === "izin" && keterangan ? keterangan : null,
  });
  if (error?.code === "23505") return { galat: "Kamu sudah mengajukan izin untuk pertemuan ini." };
  if (error) return { galat: PESAN_IZIN[error.hint ?? ""] ?? "Gagal mengirim. Coba lagi." };
  refresh();
  return { pesan: `Terkirim, tunggu persetujuan admin ya. ${ucapanSyukur(generus.jamaah.jenisKelamin)}.` };
}

/** Batalkan pengajuan izin yang masih menunggu. */
export async function batalkanIzin(id: string): Promise<StateAksi> {
  const generus = await getGenerusSaatIni();
  if (!generus) return { galat: "Sesimu sudah berakhir. Silakan masuk lagi." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pengajuan_izin").delete().eq("id", id).select("id");
  if (error || !data?.length) return { galat: "Tidak bisa dibatalkan (mungkin sudah ditanggapi admin)." };
  refresh();
  return { pesan: "Pengajuan dibatalkan." };
}

export async function keluarGenerus() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

export type HasilAbsen = {
  hasil:
    | "tercatat"
    | "sudah"
    | "kedaluwarsa"
    | "qr_tidak_sah"
    | "sesi_ditutup"
    | "bukan_peserta"
    | "jamaah_nonaktif"
    | "bukan_generus"
    | "galat";
  sesi?: string;
  dicatat_at?: string;
  /** Jenis kelamin generus (untuk ucapan syukur). */
  jenisKelamin?: "L" | "P";
};

/** Absen dari QR layar (token dari URL /absen?t=...). */
export async function absen(token: string): Promise<HasilAbsen> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("absen_layar", { p_token: token.slice(0, 120) });
  if (error || !data) return { hasil: "galat" };
  const generus = await getGenerusSaatIni();
  return { ...(data as HasilAbsen), jenisKelamin: generus?.jamaah.jenisKelamin };
}
