"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { usePerangkat } from "@/components/perangkat/use-perangkat";

type PromptPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type Browser =
  | "ios-safari"
  | "ios-lain"
  | "samsung"
  | "chrome"
  | "firefox"
  | "edge"
  | "opera"
  | "android-lain"
  | "dalam-aplikasi"
  | "desktop";

type Perangkat = "server" | "terpasang" | "ditutup" | Browser;

/** Kenali browser dari user agent (hanya untuk memilih petunjuk pasang). */
export function kenaliBrowser(ua: string, sentuh = 0): Browser {
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && sentuh > 1);
  const android = /Android/.test(ua);
  // Browser di dalam aplikasi lain (WhatsApp, Instagram, Facebook, LINE, TikTok, WebView).
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|musical_ly|TikTok|; wv\)/.test(ua)) return "dalam-aplikasi";
  if (iOS) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return "ios-lain";
    return /Safari/.test(ua) ? "ios-safari" : "dalam-aplikasi";
  }
  if (!android) return "desktop";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/EdgA/.test(ua)) return "edge";
  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Firefox/.test(ua)) return "firefox";
  if (/MiuiBrowser|XiaoMi|HeyTapBrowser|VivoBrowser|OppoBrowser|UCBrowser|YaBrowser|Silk/.test(ua)) return "android-lain";
  if (/Chrome\//.test(ua)) return "chrome";
  return "android-lain";
}

/** Langkah memasang secara manual, per browser (bila dialog otomatis tidak ada). */
const PETUNJUK: Record<Exclude<Browser, "desktop">, string[]> = {
  "ios-safari": [
    "Ketuk tombol Bagikan (kotak dengan panah ke atas) di bawah layar.",
    "Geser ke bawah, pilih Tambah ke Layar Utama.",
    "Ketuk Tambah di kanan atas.",
  ],
  "ios-lain": [
    "Ketuk tombol Bagikan (kotak dengan panah ke atas).",
    "Pilih Tambah ke Layar Utama, lalu Tambah.",
    "Bila pilihan itu tidak ada, buka alamat ini di Safari lalu ulangi.",
  ],
  samsung: [
    "Ketuk ikon pasang (panah ke bawah) di bilah alamat bila ada, lalu Pasang.",
    "Bila tidak ada: ketuk menu ☰ di kanan bawah → Tambah halaman ke → Layar Utama.",
  ],
  chrome: ["Ketuk menu ⋮ di kanan atas.", "Pilih Instal aplikasi (atau Tambahkan ke layar utama), lalu Instal."],
  firefox: ["Ketuk menu ⋮.", "Pilih Instal (atau Tambahkan ke layar utama)."],
  edge: ["Ketuk menu ··· di bawah layar.", "Pilih Tambahkan ke telepon (atau Tambahkan ke layar utama)."],
  opera: ["Ketuk menu ⋮.", "Pilih Layar utama (atau Tambahkan ke… → Layar utama)."],
  "android-lain": [
    "Ketuk menu browser, lalu cari Tambahkan ke layar utama.",
    "Bila tidak ada, salin alamat di bawah dan buka di Chrome atau Samsung Internet, lalu pasang dari sana.",
  ],
  "dalam-aplikasi": [
    "KawanKu sedang dibuka dari dalam aplikasi lain (mis. WhatsApp), yang tidak bisa memasang aplikasi.",
    "Ketuk menu ⋮ / ··· lalu pilih Buka di browser (Chrome, Samsung Internet, atau Safari).",
    "Atau salin alamat di bawah dan tempel di browser, lalu pasang dari sana.",
  ],
};

/** Keadaan perangkat (dibaca di browser; "server" saat render server). */
function bacaPerangkat(): Perangkat {
  const terpasang =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (terpasang) return "terpasang";
  try {
    if (localStorage.getItem("kk-pasang-tutup") === "1") return "ditutup";
  } catch {}
  return kenaliBrowser(navigator.userAgent, navigator.maxTouchPoints);
}
const tanpaLangganan = () => () => {};

/**
 * Ajakan memasang KawanKu di layar utama. Bila browser mendukung dialog
 * pasang (Chrome, Samsung Internet, Edge, Opera di Android; Chrome/Edge di
 * laptop) tombolnya langsung memunculkan dialog itu. Selain itu (iPhone,
 * Firefox, browser bawaan HP, atau browser di dalam WhatsApp) ditampilkan
 * langkah manual sesuai browsernya. Tidak tampil bila sudah terpasang atau
 * sudah ditutup.
 */
export function TombolPasang({ className = "" }: { className?: string }) {
  const perangkat = useSyncExternalStore(tanpaLangganan, bacaPerangkat, () => "server" as const);
  const [prompt, setPrompt] = useState<PromptPasang | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [petunjuk, setPetunjuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const jenis = usePerangkat();

  useEffect(() => {
    if (perangkat === "server" || perangkat === "terpasang" || perangkat === "ditutup") return;
    const tangkap = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptPasang);
    };
    const terpasang = () => setSelesai(true);
    window.addEventListener("beforeinstallprompt", tangkap);
    window.addEventListener("appinstalled", terpasang);
    return () => {
      window.removeEventListener("beforeinstallprompt", tangkap);
      window.removeEventListener("appinstalled", terpasang);
    };
  }, [perangkat]);

  if (perangkat === "server" || perangkat === "terpasang" || perangkat === "ditutup" || selesai) return null;
  // Laptop: hanya bila browser menawarkan dialog pasang.
  if (perangkat === "desktop" && !prompt) return null;
  const langkah = perangkat === "desktop" ? [] : PETUNJUK[perangkat];
  const bisaSalin = perangkat === "dalam-aplikasi" || perangkat === "android-lain" || perangkat === "ios-lain";

  function tutup() {
    setSelesai(true);
    try {
      localStorage.setItem("kk-pasang-tutup", "1");
    } catch {}
  }

  async function pasang() {
    if (!prompt) return setPetunjuk((v) => !v);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setSelesai(true);
    setPrompt(null);
  }

  async function salin() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setTersalin(true);
    } catch {}
  }

  return (
    <div className={`rounded-card bg-primary-soft p-4 text-sm ${className}`}>
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">Pasang KawanKu di perangkat ini</p>
          <p className="mt-0.5 text-muted">
            {jenis === "laptop"
              ? "Buka lebih cepat dari ikon di desktop atau taskbar, seperti aplikasi biasa."
              : "Buka lebih cepat dari layar utama, seperti aplikasi biasa."}
          </p>
          <button
            type="button"
            onClick={pasang}
            aria-expanded={prompt ? undefined : petunjuk}
            className="mt-3 inline-flex h-9 items-center rounded-pill bg-primary px-4 font-semibold text-primary-fg"
          >
            {prompt ? "Pasang aplikasi" : "Cara memasang"}
          </button>
          {!prompt && petunjuk && (
            <div className="mt-3 flex flex-col gap-2 text-fg">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5">
                {langkah.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
              {bisaSalin && (
                <button
                  type="button"
                  onClick={salin}
                  className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 text-xs font-medium"
                >
                  {tersalin ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                  {tersalin ? "Alamat tersalin" : "Salin alamat KawanKu"}
                </button>
              )}
            </div>
          )}
        </div>
        <button type="button" onClick={tutup} aria-label="Tutup ajakan pasang" className="text-muted hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
