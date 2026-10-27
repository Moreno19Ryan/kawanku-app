"use client";

import { useSyncExternalStore } from "react";
import { salamWaktu } from "@/lib/generus/sambutan";

const tanpaLangganan = () => () => {};

/** "Assalamu'alaikum · Selamat pagi" (jam perangkat dihitung dalam WIB; server hanya salam). */
export function SalamWaktu({ className = "" }: { className?: string }) {
  const waktu = useSyncExternalStore(tanpaLangganan, () => salamWaktu(), () => null);
  return (
    <p className={className}>
      Assalamu&apos;alaikum{waktu && ` · ${waktu}`}
    </p>
  );
}
