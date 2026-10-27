"use client";

import { kataTekan } from "@/lib/perangkat";
import { usePerangkat } from "./use-perangkat";

/** "Klik" (laptop) / "Ketuk" (HP, tablet) di tengah teks halaman server. */
export function KataTekan() {
  return kataTekan(usePerangkat());
}
