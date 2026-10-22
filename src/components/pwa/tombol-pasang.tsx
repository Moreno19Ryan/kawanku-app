"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

type PromptPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Ajakan memasang KawanKu di layar utama HP. Android/Chrome: tombol yang
 * memunculkan dialog pasang. iPhone/iPad (Safari tidak punya dialog pasang):
 * petunjuk Bagikan → Tambah ke Layar Utama. Tidak tampil bila aplikasi
 * sudah terpasang (dibuka dari ikon) atau sudah ditutup pengguna.
 */
/** Keadaan perangkat (dibaca sekali di browser; "server" saat render server). */
function bacaPerangkat(): "server" | "terpasang" | "ditutup" | "ios" | "lain" {
  const terpasang =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (terpasang) return "terpasang";
  try {
    if (localStorage.getItem("kk-pasang-tutup") === "1") return "ditutup";
  } catch {}
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return iOS ? "ios" : "lain";
}
const tanpaLangganan = () => () => {};

export function TombolPasang({ className = "" }: { className?: string }) {
  const perangkat = useSyncExternalStore(tanpaLangganan, bacaPerangkat, () => "server" as const);
  const [prompt, setPrompt] = useState<PromptPasang | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [petunjuk, setPetunjuk] = useState(false);
  const ios = perangkat === "ios";

  useEffect(() => {
    if (perangkat !== "lain") return;
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

  const tampil = !selesai && (ios || (perangkat === "lain" && prompt !== null));
  if (!tampil) return null;

  function tutup() {
    setSelesai(true);
    try {
      localStorage.setItem("kk-pasang-tutup", "1");
    } catch {}
  }

  async function pasang() {
    if (ios) return setPetunjuk((v) => !v);
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setSelesai(true);
    setPrompt(null);
  }

  return (
    <div className={`rounded-card bg-primary-soft p-4 text-sm ${className}`}>
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">Pasang KawanKu di HP</p>
          <p className="mt-0.5 text-muted">Buka lebih cepat dari layar utama, seperti aplikasi biasa.</p>
          <button
            type="button"
            onClick={pasang}
            className="mt-3 inline-flex h-9 items-center rounded-pill bg-primary px-4 font-semibold text-primary-fg"
          >
            {ios ? "Cara memasang" : "Pasang aplikasi"}
          </button>
          {ios && petunjuk && (
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-fg">
              <li>
                Buka halaman ini di <b>Safari</b>.
              </li>
              <li>
                Ketuk tombol <b>Bagikan</b> <Share className="inline size-4 align-text-bottom" aria-label="ikon Bagikan" /> di
                bawah layar.
              </li>
              <li>
                Pilih <b>Tambah ke Layar Utama</b>{" "}
                <SquarePlus className="inline size-4 align-text-bottom" aria-label="ikon Tambah" />, lalu <b>Tambah</b>.
              </li>
            </ol>
          )}
        </div>
        <button type="button" onClick={tutup} aria-label="Tutup ajakan pasang" className="text-muted hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
