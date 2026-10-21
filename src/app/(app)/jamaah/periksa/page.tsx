import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleAlert, CircleCheck } from "lucide-react";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { KembaliKeJamaah } from "@/components/jamaah/kembali";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DaftarUsulan } from "@/components/jamaah/daftar-usulan";
import { getPerluDicek } from "@/lib/jamaah/periksa";
import { getUsulanMenunggu } from "@/lib/jamaah/usulan";

export const metadata: Metadata = {
  title: "Perlu dicek",
};

export default function PerluDicekPage() {
  return (
    <>
      <KembaliKeJamaah />
      <PageHeader
        title="Perlu dicek"
        description="Data jamaah aktif yang belum lengkap atau perlu dipastikan. Daftar ini berkurang sendiri setelah datanya dibetulkan."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarPeriksa />
      </Suspense>
    </>
  );
}

async function DaftarPeriksa() {
  const [periksa, usulan] = await Promise.all([getPerluDicek(), getUsulanMenunggu()]);
  if (!periksa) return <JamaahBelumMenyala />;

  const total = periksa.perJamaah.size;
  if (periksa.daftar.length === 0) {
    return (
      <Card className="text-sm text-muted">
        Peranmu hanya bisa melihat data jamaah, jadi tidak ada yang perlu kamu rapikan di sini.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DaftarUsulan usulan={usulan} />
      <Card className="flex items-center gap-3">
        {total === 0 ? (
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <CircleAlert className="size-5 shrink-0 text-warning" aria-hidden />
        )}
        <p className="text-sm">
          {total === 0 ? (
            "Semua data jamaah aktif sudah rapi."
          ) : (
            <>
              <span className="font-semibold">{total} jamaah</span> punya minimal satu hal yang perlu
              dicek, dari {periksa.baris.size} jamaah aktif.
            </>
          )}
        </p>
      </Card>

      <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
        {periksa.daftar.map((p) => {
          const n = periksa.hasil[p.kode].length;
          const isi = (
            <>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-pill text-sm font-semibold tabular-nums ${
                  n === 0 ? "bg-success/10 text-success" : "bg-warning/15 text-fg"
                }`}
              >
                {n === 0 ? <CircleCheck className="size-5" aria-label="Beres" /> : n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.judul}</span>
                <span className="block text-sm text-muted">{p.keterangan}</span>
              </span>
              {n > 0 && <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />}
            </>
          );
          return (
            <li key={p.kode}>
              {n > 0 ? (
                <Link
                  href={`/jamaah?periksa=${p.kode}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
                >
                  {isi}
                </Link>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4">{isi}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
