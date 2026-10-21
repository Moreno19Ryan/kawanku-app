"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { perbaruiBilah, temaEfektif, terapkanTema } from "./tema-client";

/**
 * Tombol cepat ganti terang ↔ gelap. Ikonnya ditentukan CSS (varian dark),
 * jadi tidak ada beda render server/browser.
 */
export function TombolTema({ className = "" }: { className?: string }) {
  // Saat halaman dibuka, samakan warna bilah browser dengan tema tersimpan.
  useEffect(() => perbaruiBilah(), []);

  return (
    <button
      type="button"
      onClick={() => terapkanTema(temaEfektif() === "gelap" ? "terang" : "gelap")}
      aria-label="Ganti tema terang/gelap"
      title="Ganti tema terang/gelap"
      className={`flex size-10 items-center justify-center rounded-pill text-muted transition-colors duration-200 ease-oneui hover:bg-surface-muted hover:text-fg ${className}`}
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}
