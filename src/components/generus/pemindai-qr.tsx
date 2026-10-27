"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KameraQr } from "@/components/ui/kamera-qr";
import { usePerangkat } from "@/components/perangkat/use-perangkat";

/** Ambil token absen dari isi QR: URL ".../absen?t=..." atau token mentah. */
function tokenDari(isi: string): string | null {
  try {
    const url = new URL(isi);
    if (url.pathname === "/absen") return url.searchParams.get("t");
  } catch {
    // Bukan URL.
  }
  return /^[0-9a-f-]{36}\.\d+\.[\w-]+$/.test(isi) ? isi : null;
}

/** Kamera belakang + jsQR. Setelah QR absen terbaca → /absen?t=... */
export function PemindaiQr() {
  const router = useRouter();
  const [bukanAbsen, setBukanAbsen] = useState(false);
  const perangkat = usePerangkat();
  return (
    <KameraQr
      onBaca={(isi) => {
        const token = tokenDari(isi);
        if (!token) {
          setBukanAbsen(true);
          return "lanjut";
        }
        router.push(`/absen?t=${encodeURIComponent(token)}`);
        return "berhenti";
      }}
      catatanGagal={
        perangkat === "laptop"
          ? "Masih tidak bisa? Buka KawanKu di HP lalu scan dari sana, atau minta admin mencatat kehadiranmu."
          : `Masih tidak bisa? Scan QR di layar admin dengan aplikasi kamera ${perangkat === "tablet" ? "tablet" : "HP"}, atau minta admin mencatat kehadiranmu.`
      }
      keterangan={
        <p role="status" className="text-center text-sm text-muted">
          {bukanAbsen ? "QR ini bukan QR absen. Arahkan ke QR di layar admin." : "Arahkan kamera ke QR di layar admin…"}
        </p>
      }
    />
  );
}
