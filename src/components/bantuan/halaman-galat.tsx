"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { TombolKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { laporGalatKlien } from "@/lib/sistem/actions";

/**
 * Isi halaman galat (error.tsx): coba lagi, atau hubungi pengembang.
 * Galat dari klien (tanpa digest) dilaporkan ke pemantau galat; galat
 * server sudah dicatat onRequestError.
 */
export function HalamanGalat({ error, retry }: { error: unknown; retry: () => void }) {
  const kode = error instanceof Error && "digest" in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
    if (kode) return;
    const pesan = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    laporGalatKlien(pesan, window.location.pathname).catch(() => {});
  }, [error, kode]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center py-10">
      <Card className="flex max-w-lg flex-col items-center gap-4 p-8 text-center sm:p-10">
        <span className="flex size-16 items-center justify-center rounded-pill bg-danger/10 text-danger">
          <TriangleAlert className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Terjadi kendala</h1>
        <p className="text-muted">
          Halaman ini gagal dimuat dan sudah tercatat otomatis untuk pengembang. Coba lagi; kalau masih bermasalah,
          hubungi pengembang.
        </p>
        {kode && (
          <p className="text-xs text-muted">
            Kode galat: <span className="font-mono">{kode}</span> (sebutkan saat melapor)
          </p>
        )}
        <button type="button" onClick={() => retry()} className={buttonClass("netral")}>
          Coba lagi
        </button>
        <TombolKontakPengembang className="w-full justify-center sm:w-auto" />
      </Card>
    </div>
  );
}
