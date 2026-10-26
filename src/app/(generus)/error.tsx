"use client";

import { HalamanGalat } from "@/components/bantuan/halaman-galat";

/** Galat tak terduga di area generus: coba lagi, atau hubungi pengembang. */
export default function GalatGenerus(props: { error: unknown; retry: () => void }) {
  return <HalamanGalat {...props} />;
}
