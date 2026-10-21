"use client";

import { KUNCI_TEMA, WARNA_BILAH, type PilihanTema } from "@/lib/tema";

const PENDENGAR = new Set<() => void>();

export function bacaPilihanTema(): PilihanTema {
  try {
    const t = localStorage.getItem(KUNCI_TEMA);
    if (t === "terang" || t === "gelap") return t;
  } catch {
    // localStorage bisa diblokir (mode privat tertentu); pakai bawaan.
  }
  return "sistem";
}

/** Tema yang benar-benar tampil sekarang (sistem → cek perangkat). */
export function temaEfektif(): "terang" | "gelap" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return "gelap";
  if (attr === "light") return "terang";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang";
}

export function terapkanTema(pilihan: PilihanTema) {
  const html = document.documentElement;
  if (pilihan === "sistem") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", pilihan === "gelap" ? "dark" : "light");

  try {
    if (pilihan === "sistem") localStorage.removeItem(KUNCI_TEMA);
    else localStorage.setItem(KUNCI_TEMA, pilihan);
  } catch {
    // Tetap berlaku untuk halaman ini walau tidak tersimpan.
  }

  perbaruiBilah();
  PENDENGAR.forEach((f) => f());
}

/** Samakan warna bilah browser (meta theme-color) dengan tema aplikasi. */
export function perbaruiBilah() {
  const warna = WARNA_BILAH[temaEfektif()];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", warna);
  });
}

/** Untuk useSyncExternalStore. */
export function langgananTema(f: () => void) {
  PENDENGAR.add(f);
  return () => PENDENGAR.delete(f);
}
