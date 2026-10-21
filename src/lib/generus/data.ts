import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CatatanKehadiran } from "./kehadiran";

/** Riwayat kehadiran generus yang login, termasuk pertemuan terlewat (RPC). */
export const getKehadiranSaya = cache(async (batas = 120): Promise<CatatanKehadiran[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("kehadiran_saya", { p_batas: batas });
  return (data ?? []) as CatatanKehadiran[];
});
