"use client";

import { useRef } from "react";
import { KeyRound, LockKeyhole, X } from "lucide-react";
import { TombolKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { TombolPasang } from "@/components/pwa/tombol-pasang";

/**
 * "Butuh bantuan?" di halaman masuk: panel dari bawah (HP) / di tengah
 * (laptop), berisi lupa PIN/kata sandi, pasang aplikasi, dan kontak
 * pengembang. <dialog> asli: Esc menutup, fokus tetap di dalam panel.
 */
export function PanelBantuan({ jenis }: { jenis: "generus" | "admin" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tutup = () => ref.current?.close();

  const butir = [
    {
      ikon: LockKeyhole,
      judul: "Lupa PIN (generus)",
      isi: "Silakan minta admin kelompok mengembalikan PIN ke PIN awal, lalu buat PIN baru setelah masuk.",
    },
    {
      ikon: KeyRound,
      judul: "Lupa kata sandi (admin)",
      isi: "Silakan minta atur ulang ke admin yang mengelola akun.",
    },
  ];
  if (jenis === "admin") butir.reverse();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-pill px-3 py-2.5 text-sm font-medium text-primary transition-colors duration-200 ease-oneui hover:bg-primary-soft"
      >
        Butuh bantuan?
      </button>
      <dialog
        ref={ref}
        aria-labelledby="judul-bantuan"
        onClick={(e) => e.target === ref.current && tutup()}
        className="m-0 mt-auto w-full max-w-none rounded-t-card bg-surface p-0 text-fg backdrop:bg-black/45 kk-panel sm:m-auto sm:max-w-md sm:rounded-card"
      >
        <div className="flex flex-col gap-4 px-5 pt-3 pb-6 sm:pt-6">
          <span aria-hidden className="mx-auto h-1.5 w-10 rounded-pill bg-border sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 id="judul-bantuan" className="text-xl font-semibold tracking-tight">
              Butuh bantuan?
            </h2>
            <button
              type="button"
              onClick={tutup}
              aria-label="Tutup"
              className="flex size-11 items-center justify-center rounded-pill bg-surface-muted transition-colors duration-200 ease-oneui hover:bg-border"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <ul className="flex flex-col overflow-hidden rounded-card bg-bg">
            {butir.map(({ ikon: Ikon, judul, isi }) => (
              <li key={judul} className="flex gap-3.5 border-b border-border p-4 last:border-b-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
                  <Ikon className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{judul}</span>
                  <span className="text-sm text-muted">{isi}</span>
                </span>
              </li>
            ))}
          </ul>

          <TombolPasang />

          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-muted">Aplikasi bermasalah? Silakan hubungi pengembang:</p>
            <TombolKontakPengembang />
          </div>
        </div>
      </dialog>
    </>
  );
}
