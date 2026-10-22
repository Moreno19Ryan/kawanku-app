"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (syarat PWA bisa dipasang + halaman offline). */
export function DaftarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
