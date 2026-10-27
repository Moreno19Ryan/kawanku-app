"use server";

import { createClient } from "@/lib/supabase/server";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { kirimPush, pushSiap } from "./kirim";

type Langganan = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

/** Simpan langganan Web Push perangkat ini untuk akun yang login. */
export async function simpanLangganan(langganan: Langganan, perangkat: string): Promise<StateAksi> {
  const { endpoint, keys } = langganan ?? {};
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !keys?.p256dh || !keys.auth) {
    return { galat: "Data langganan tidak valid." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_langganan_notifikasi", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_perangkat: String(perangkat ?? "").slice(0, 120) || null,
  });
  if (error) return { galat: "Mohon maaf, notifikasi belum berhasil dinyalakan. Silakan coba lagi." };
  return { pesan: "Notifikasi menyala di perangkat ini." };
}

/** Matikan langganan perangkat ini. */
export async function matikanLangganan(endpoint: string): Promise<StateAksi> {
  if (typeof endpoint !== "string") return { galat: "Tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("matikan_langganan_notifikasi", { p_endpoint: endpoint });
  if (error) return { galat: "Mohon maaf, notifikasi belum berhasil dimatikan. Silakan coba lagi." };
  return { pesan: "Notifikasi dimatikan di perangkat ini." };
}

/** Kirim notifikasi uji ke perangkat ini (langganan milik sendiri, lewat RLS). */
export async function kirimTesNotifikasi(endpoint: string): Promise<StateAksi> {
  if (!pushSiap()) return { galat: "Notifikasi belum disiapkan pengembang." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("langganan_notifikasi")
    .select("endpoint, p256dh, auth_key")
    .eq("endpoint", endpoint)
    .eq("aktif", true)
    .maybeSingle<{ endpoint: string; p256dh: string; auth_key: string }>();
  if (!data) return { galat: "Perangkat ini belum berlangganan." };
  const hasil = await kirimPush([
    {
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth_key,
      judul: "Notifikasi KawanKu menyala",
      isi: "InsyaAllah pengingat pengajian akan muncul seperti ini.",
      url: "/saya",
      tag: "uji",
    },
  ]);
  if (!hasil.terkirim.length) return { galat: "Notifikasi uji gagal terkirim. Coba matikan lalu nyalakan lagi." };
  return { pesan: "Notifikasi uji terkirim." };
}
