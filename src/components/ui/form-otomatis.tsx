"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/** Kolom ketik (dicari setelah jeda), selain itu (pilihan, tanggal) langsung. */
const KETIK = new Set(["text", "search"]);

/**
 * Form pencarian/filter (GET) yang langsung menerapkan isiannya tanpa
 * tombol: kolom pencarian dicari setelah berhenti mengetik sebentar,
 * pilihan (select, tanggal, bulan) langsung saat diubah. Isian kosong
 * dibuang dari URL; nomor halaman ikut kembali ke 1. Enter tetap bisa.
 */
export function FormOtomatis({
  className = "",
  jeda = 300,
  children,
}: {
  className?: string;
  jeda?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function terapkan(form: HTMLFormElement) {
    clearTimeout(timer.current);
    // Isian wajib yang belum dipilih (mis. sesi rekap) → tunggu dulu.
    if (!form.checkValidity()) return;
    const param = new URLSearchParams();
    for (const [kunci, nilai] of new FormData(form)) {
      const teks = String(nilai).trim();
      if (teks) param.append(kunci, teks);
    }
    const qs = param.toString();
    const tujuan = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (tujuan === window.location.pathname + window.location.search) return;
    startTransition(() => router.replace(tujuan, { scroll: false }));
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const el = e.target as HTMLInputElement;
    if (el.tagName === "INPUT" && KETIK.has(el.type)) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => terapkan(form), jeda);
    } else {
      // Sesudah React selesai memperbarui form (mis. kolom yang berganti).
      clearTimeout(timer.current);
      timer.current = setTimeout(() => terapkan(form), 0);
    }
  }

  return (
    <form
      method="get"
      role="search"
      aria-busy={pending}
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        terapkan(e.currentTarget);
      }}
      className={`relative ${className}`}
    >
      {children}
      <span
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute -top-2 right-3 flex items-center gap-1.5 rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-opacity duration-200 ease-oneui ${pending ? "opacity-100" : "opacity-0"}`}
      >
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {pending ? "Mencari…" : ""}
      </span>
    </form>
  );
}
