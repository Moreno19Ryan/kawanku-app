"use server";

import { refresh } from "next/cache";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

const LABEL: Record<string, string> = { jamaah: "Jamaah", keluarga: "Keluarga", kegiatan: "Kegiatan" };

/** Kembalikan entri tempat sampah beserta data yang ikut terhapus (wewenang dicek database). */
export async function kembalikanSampah(id: string): Promise<StateAksi> {
  const supabase = await createClient();
  const { data: entri } = await supabase.from("tempat_sampah").select("jenis, label").eq("id", id).maybeSingle();
  const { data, error } = await supabase.rpc("kembalikan_dari_sampah", { p_id: id });
  if (error?.code === "42501") return { galat: "Di luar wewenang akun ini atau sudah tidak ada." };
  if (error) return { galat: error.message.replace(/^Tidak bisa dikembalikan: /, "Tidak bisa dikembalikan: ") };
  refresh();
  const dilewati = (data as { dilewati?: string[] } | null)?.dilewati ?? [];
  const nama = entri ? `${LABEL[entri.jenis] ?? ""} ${entri.label}`.trim() : "Data";
  return dilewati.length
    ? { pesan: `${nama} dikembalikan, kecuali sebagian ${[...new Set(dilewati)].join(", ")} (data induknya sudah tidak ada).` }
    : { pesan: `${nama} dikembalikan seperti semula. Alhamdulillah.` };
}

export async function hapusPermanenSampah(id: string): Promise<StateAksi> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("hapus_permanen_sampah", { p_id: id });
  if (error) return { galat: "Di luar wewenang akun ini atau sudah tidak ada." };
  refresh();
  return { pesan: "Dihapus permanen." };
}
