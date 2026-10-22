"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { BellRing, ChevronRight, HeartHandshake, Lightbulb, Sparkles, TriangleAlert, X } from "lucide-react";
import type { JenisSaran, Saran } from "@/lib/asisten/hitung";

const GAYA: Record<JenisSaran, { ikon: typeof BellRing; warna: string; label: string }> = {
  peringatan: { ikon: TriangleAlert, warna: "text-warning", label: "Peringatan" },
  pengingat: { ikon: BellRing, warna: "text-primary", label: "Pengingat" },
  saran: { ikon: Lightbulb, warna: "text-primary", label: "Saran" },
  apresiasi: { ikon: HeartHandshake, warna: "text-success", label: "Apresiasi" },
};

const KUNCI = "kk-asisten-tutup";
const MAKS = 4;

function bacaTutup(): string {
  try {
    return localStorage.getItem(KUNCI) ?? "";
  } catch {
    return "";
  }
}
const pendengar = new Set<() => void>();
function langganan(f: () => void) {
  pendengar.add(f);
  return () => pendengar.delete(f);
}

/**
 * Kartu "Asisten KawanKu": pengingat, peringatan, saran, dan apresiasi.
 * Tiap butir bisa ditutup (diingat di perangkat ini sampai butirnya berubah).
 */
export function KartuAsisten({ saran, className = "" }: { saran: Saran[]; className?: string }) {
  const tutupStr = useSyncExternalStore(langganan, bacaTutup, () => "");
  const [semua, setSemua] = useState(false);
  const ditutup = new Set(tutupStr.split("|").filter(Boolean));
  const tampil = saran.filter((s) => !ditutup.has(s.kode));
  if (!tampil.length) return null;

  function tutup(kode: string) {
    try {
      // Simpan hanya kode yang masih relevan supaya tidak menumpuk.
      const masih = saran.map((s) => s.kode).filter((k) => ditutup.has(k) || k === kode);
      localStorage.setItem(KUNCI, masih.join("|"));
    } catch {}
    pendengar.forEach((f) => f());
  }

  const daftar = semua ? tampil : tampil.slice(0, MAKS);
  return (
    <section aria-label="Asisten KawanKu" className={`rounded-card bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6 ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="size-5 text-primary" aria-hidden />
        Asisten KawanKu
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-border">
        {daftar.map((s) => {
          const g = GAYA[s.jenis];
          const Ikon = g.ikon;
          const isi = (
            <>
              <Ikon className={`mt-0.5 size-5 shrink-0 ${g.warna}`} aria-label={g.label} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.judul}</span>
                <span className="block text-sm text-muted">{s.isi}</span>
              </span>
              {s.href && <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />}
            </>
          );
          return (
            <li key={s.kode} className="flex items-start gap-2 py-3">
              {s.href ? (
                <Link href={s.href} className="-mx-2 flex min-w-0 flex-1 items-start gap-3 rounded-control px-2 py-1 transition-colors hover:bg-surface-muted">
                  {isi}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3 py-1">{isi}</div>
              )}
              <button
                type="button"
                onClick={() => tutup(s.kode)}
                aria-label={`Tutup: ${s.judul}`}
                className="mt-1 rounded-pill p-1 text-muted hover:bg-surface-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {tampil.length > MAKS && (
        <button type="button" onClick={() => setSemua((v) => !v)} className="mt-1 text-sm font-medium text-primary">
          {semua ? "Tampilkan lebih sedikit" : `Lihat semua (${tampil.length})`}
        </button>
      )}
    </section>
  );
}
