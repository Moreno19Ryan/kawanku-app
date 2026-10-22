"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import jsQR from "jsqr";
import { CameraOff, RotateCw } from "lucide-react";
import { kenaliBrowser, type Browser } from "@/components/pwa/tombol-pasang";
import { buttonClass } from "@/components/ui/button";

type GalatKamera = "ditolak" | "tidak-ada" | "dipakai" | "tidak-didukung";

/** Jenis galat getUserMedia → pesan yang bisa ditindaklanjuti pengguna. */
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

/** "lanjut" = terus memindai; "berhenti" = QR sudah dipakai, kamera berhenti. */
export type HasilBaca = "lanjut" | "berhenti";

/**
 * Kamera belakang + jsQR, dengan bantuan izin kamera per browser bila gagal.
 * `onBaca` dipanggil untuk setiap QR yang terbaca (boleh berulang; penyaring
 * duplikat di pemanggil).
 */
export function KameraQr({
  onBaca,
  keterangan,
  catatanGagal,
  className = "aspect-square w-full",
}: {
  onBaca: (isi: string) => HasilBaca;
  keterangan?: ReactNode;
  catatanGagal?: string;
  /** Ukuran video. */
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const baca = useRef(onBaca);
  const [galat, setGalat] = useState<{ jenis: GalatKamera; browser: Browser }>();
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    baca.current = onBaca;
  });

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
        if (kode?.data && baca.current(kode.data) === "berhenti") {
          berhenti = true;
          return;
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
  }, [percobaan]);

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
            setPercobaan((n) => n + 1);
          }}
          className={buttonClass("utama")}
        >
          <RotateCw className="size-4" aria-hidden />
          Coba lagi
        </button>
        {catatanGagal && <p className="text-center text-xs text-muted">{catatanGagal}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card bg-black">
        <video ref={video} playsInline muted className={`${className} object-cover`} />
        <div className="pointer-events-none absolute inset-[12%] rounded-card border-4 border-white/80" />
      </div>
      {keterangan}
    </div>
  );
}
