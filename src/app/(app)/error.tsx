"use client";

import { HalamanGalat } from "@/components/bantuan/halaman-galat";

/** Galat tak terduga di area admin: coba lagi, atau hubungi pengembang. */
export default function GalatAplikasi(props: { error: unknown; retry: () => void }) {
  return <HalamanGalat {...props} />;
}
