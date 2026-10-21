"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { TombolKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Galat tak terduga di area admin: coba lagi, atau hubungi pengembang. */
export default function GalatAplikasi({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const kode = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="flex min-h-[60dvh] items-center justify-center py-10">
      <Card className="flex max-w-lg flex-col items-center gap-4 p-8 text-center sm:p-10">
        <span className="flex size-16 items-center justify-center rounded-pill bg-danger/10 text-danger">
          <TriangleAlert className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Terjadi kendala</h1>
        <p className="text-muted">
          Halaman ini gagal dimuat. Coba lagi; kalau masih bermasalah, hubungi pengembang.
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
