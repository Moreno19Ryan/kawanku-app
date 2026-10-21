"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getGenerusSaatIni, pinDariTanggalLahir } from "@/lib/generus/akun";
import { tujuanGenerus } from "@/lib/generus/tujuan";
import { bacaAlamat } from "@/lib/jamaah/alamat";
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

  const { error } = await supabase.auth.updateUser({ password: pin });
  if (error) {
    return {
      galat: error.code === "same_password" ? "PIN baru harus berbeda dari PIN lama." : "Gagal mengganti PIN. Coba lagi.",
    };
  }
  await supabase.rpc("pin_generus_diganti");
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
  return { pesan: "Alamat tersimpan. Jazaakallahu khoiro!" };
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
};

/** Absen dari QR layar (token dari URL /absen?t=...). */
export async function absen(token: string): Promise<HasilAbsen> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("absen_layar", { p_token: token.slice(0, 120) });
  if (error || !data) return { hasil: "galat" };
  return data as HasilAbsen;
}
