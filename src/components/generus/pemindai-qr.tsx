"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";

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
  const video = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [galat, setGalat] = useState<string>();
  const [bukanAbsen, setBukanAbsen] = useState(false);

  useEffect(() => {
    let aliran: MediaStream | undefined;
    let berhenti = false;
    let timer: ReturnType<typeof setTimeout>;
    const kanvas = document.createElement("canvas");
    const ctx = kanvas.getContext("2d", { willReadFrequently: true });

    function pindai() {
      const v = video.current;
      if (berhenti || !v || !ctx) return;
      if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth) {
        const skala = Math.min(1, 640 / v.videoWidth);
        kanvas.width = Math.round(v.videoWidth * skala);
        kanvas.height = Math.round(v.videoHeight * skala);
        ctx.drawImage(v, 0, 0, kanvas.width, kanvas.height);
        const gambar = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
        const kode = jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: "dontInvert" });
        if (kode?.data) {
          const token = tokenDari(kode.data);
          if (token) {
            berhenti = true;
            router.push(`/absen?t=${encodeURIComponent(token)}`);
            return;
          }
          setBukanAbsen(true);
        }
      }
      timer = setTimeout(pindai, 200);
    }

    // Tanpa mediaDevices (browser lama / bukan HTTPS) → langsung ke pesan galat.
    Promise.resolve(navigator.mediaDevices)
      .then((md) => md.getUserMedia({ video: { facingMode: "environment" }, audio: false }))
      .then((s) => {
        aliran = s;
        if (berhenti || !video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        pindai();
      })
      .catch(() =>
        setGalat(
          "Kamera tidak bisa dibuka. Izinkan akses kamera untuk situs ini, atau pakai aplikasi kamera HP untuk scan QR.",
        ),
      );

    return () => {
      berhenti = true;
      clearTimeout(timer);
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center">
        <CameraOff className="size-10 text-muted" aria-hidden />
        <p className="text-sm text-muted">{galat}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card bg-black">
        <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-card border-4 border-white/80" />
      </div>
      <p role="status" className="text-center text-sm text-muted">
        {bukanAbsen ? "QR ini bukan QR absen. Arahkan ke QR di layar admin." : "Arahkan kamera ke QR di layar admin…"}
      </p>
    </div>
  );
}
