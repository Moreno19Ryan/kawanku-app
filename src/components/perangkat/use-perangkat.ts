"use client";

import { useSyncExternalStore } from "react";
import { kenaliPerangkat, type JenisPerangkat } from "@/lib/perangkat";

type NavigatorUAData = Navigator & { userAgentData?: { mobile?: boolean } };

let tersimpan: JenisPerangkat | undefined;

function baca(): JenisPerangkat {
  if (!tersimpan) {
    const n = navigator as NavigatorUAData;
    tersimpan = kenaliPerangkat(n.userAgent, n.maxTouchPoints, n.userAgentData?.mobile);
  }
  return tersimpan;
}

const tanpaLangganan = () => () => {};

/**
 * Jenis perangkat yang sedang dipakai (HP, tablet, laptop/PC), untuk
 * perilaku & kata kerja ("Klik"/"Ketuk"). Saat render server & sebelum
 * hidrasi bernilai `null`.
 */
export function usePerangkat(): JenisPerangkat | null {
  return useSyncExternalStore(tanpaLangganan, baca, () => null);
}
