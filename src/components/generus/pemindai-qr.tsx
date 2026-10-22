"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CameraOff, RotateCw } from "lucide-react";
import { kenaliBrowser, type Browser } from "@/components/pwa/tombol-pasang";
import { buttonClass } from "@/components/ui/button";

type GalatKamera = "ditolak" | "tidak-ada" | "dipakai" | "tidak-didukung";

/** Jenis galat getUserMedia → pesan yang bisa ditindaklanjuti generus. */
function jenisGalat(e: unknown): GalatKamera {
  const nama = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (nama === "NotAllowedError" || nama === "SecurityError") return "ditolak";
  if (nama === "NotFoundError" || nama === "OverconstrainedError") return "tidak-ada";
  if (nama === "NotReadableError" || nama === "AbortError") return "dipakai";
  return "tidak-didukung";
}

const JUDUL: Record<GalatKamera, string> = {
  ditolak: "Akses kamera belum diizinkan",
  "tidak-ada": "Kamera tidak ditemukan",
  dipakai: "Kamera sedang dipakai aplikasi lain",
  "tidak-didukung": "Kamera tidak bisa dibuka di browser ini",
};

/** Langkah mengizinkan kamera, per browser. */
const LANGKAH_IZIN: Record<Browser, string[]> = {
  "ios-safari": [
    "Ketuk ikon aA (atau ikon pengaturan) di kolom alamat, pilih Pengaturan Situs Web.",
    "Ubah Kamera menjadi Izinkan, lalu ketuk Coba lagi.",
    "Bila tidak ada: buka Pengaturan iPhone → Safari → Kamera → Izinkan.",
  ],
  "ios-lain": [
    "Buka Pengaturan iPhone, cari nama browser ini (mis. Chrome).",
    "Nyalakan Kamera, lalu kembali ke sini dan ketuk Coba lagi.",
  ],
  samsung: [
    "Ketuk ikon gembok di kolom alamat, lalu izinkan Kamera.",
    "Bila tidak ada: Menu (≡) → Pengaturan → Situs dan unduhan → Izin situs → Kamera.",
    "Kembali ke sini dan ketuk Coba lagi.",
  ],
  chrome: [
    "Ketuk ikon di kiri alamat situs (gembok/pengaturan), pilih Izin.",
    "Nyalakan Kamera, lalu ketuk Coba lagi.",
  ],
  edge: ["Ketuk ikon gembok di kolom alamat, izinkan Kamera.", "Ketuk Coba lagi."],
  opera: ["Ketuk ikon gembok di kolom alamat, izinkan Kamera.", "Ketuk Coba lagi."],
  firefox: ["Ketuk ikon gembok di kolom alamat, izinkan Kamera.", "Ketuk Coba lagi."],
  "android-lain": [
    "Ketuk ikon gembok/info di kolom alamat, izinkan Kamera.",
    "Bila tidak ada pilihan itu, buka alamat ini di Chrome.",
  ],
  "dalam-aplikasi": [
    "Halaman ini terbuka di dalam aplikasi lain (mis. WhatsApp), yang sering memblokir kamera.",
    "Buka KawanKu di Chrome atau Safari, masuk, lalu scan lagi.",
  ],
  desktop: ["Klik ikon kamera/gembok di kolom alamat, izinkan Kamera.", "Klik Coba lagi."],
};

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
  const [galat, setGalat] = useState<{ jenis: GalatKamera; browser: Browser }>();
  const [bukanAbsen, setBukanAbsen] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

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
      .catch((e: unknown) => {
        if (berhenti) return;
        const browser = kenaliBrowser(navigator.userAgent, navigator.maxTouchPoints);
        setGalat({ jenis: browser === "dalam-aplikasi" ? "tidak-didukung" : jenisGalat(e), browser });
      });

    return () => {
      berhenti = true;
      clearTimeout(timer);
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, [router, percobaan]);

  if (galat) {
    const langkah =
      galat.jenis === "ditolak" || galat.browser === "dalam-aplikasi"
        ? LANGKAH_IZIN[galat.browser]
        : galat.jenis === "dipakai"
          ? ["Tutup aplikasi lain yang memakai kamera (mis. kamera, video call).", "Ketuk Coba lagi."]
          : galat.jenis === "tidak-ada"
            ? ["Pastikan HP/laptop punya kamera yang menyala.", "Ketuk Coba lagi."]
            : ["Buka KawanKu di Chrome atau Safari versi terbaru, lalu scan lagi."];
    return (
      <div role="alert" className="flex flex-col gap-4 rounded-card bg-surface px-5 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <CameraOff className="size-10 text-muted" aria-hidden />
          <p className="font-semibold">{JUDUL[galat.jenis]}</p>
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {langkah.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => {
            setGalat(undefined);
            setBukanAbsen(false);
            setPercobaan((n) => n + 1);
          }}
          className={buttonClass("utama")}
        >
          <RotateCw className="size-4" aria-hidden />
          Coba lagi
        </button>
        <p className="text-center text-xs text-muted">
          Masih tidak bisa? Scan QR di layar admin dengan aplikasi kamera HP, atau minta admin mencatat kehadiranmu.
        </p>
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
