import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { DokumenRekap } from "@/components/absensi/dokumen-rekap";
import { FilterRekap } from "@/components/absensi/filter-rekap";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAksesAbsensi, KOLOM_SESI, type Sesi } from "@/lib/absensi/akses";
import { bacaParamRekap, bolehEksporRekap, getRekap, pilihanWilayah, queryRekap } from "@/lib/absensi/rekap";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Rekap absensi",
};

export default function RekapPage({ searchParams }: PageProps<"/absensi/rekap">) {
  return (
    <>
      <Link href="/absensi" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <PageHeader
        title="Rekap absensi"
        description="Bulanan atau per kegiatan. Lihat pratinjau dulu, lalu cetak (PDF) atau unduh untuk Excel."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Rekap cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Rekap({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [akses, mentah] = await Promise.all([getAksesAbsensi(), cari]);
  if (!akses?.bolehLihat) return <AbsensiBelumMenyala />;

  const param = bacaParamRekap(mentah);
  const supabase = await createClient();
  const ids = akses.kelompokLihat.map((k) => k.id);
  const [{ data: sesi }, rekap] = await Promise.all([
    supabase
      .from("sesi_absensi")
      .select(KOLOM_SESI)
      .or(`kelompok_id.is.null,kelompok_id.in.(${ids.join(",")})`)
      .order("mulai", { ascending: false })
      .limit(100)
      .returns<Sesi[]>(),
    getRekap(param),
  ]);
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const ekspor = bolehEksporRekap(akses);

  return (
    <div className="flex flex-col gap-5">
      <FilterRekap
        param={rekap && !("galat" in rekap) ? rekap.param : param}
        wilayah={pilihanWilayah(akses)}
        sesi={(sesi ?? []).map((s) => ({
          id: s.id,
          label: `${tanggalJam(s.mulai)} · ${s.nama} · ${s.kelompok_id ? (namaKelompok.get(s.kelompok_id) ?? "Kelompok") : "Seluruh desa"}`,
        }))}
      />

      {!rekap || "galat" in rekap ? (
        <Card className="text-center text-sm text-muted">{rekap?.galat ?? "Rekap tidak tersedia."}</Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Pratinjau · tampilan cetak sama persis dengan ini.</p>
            {ekspor ? (
              <div className="flex flex-wrap gap-2">
                <a href={`/api/rekap?${queryRekap(rekap.param)}`} className={buttonClass("kedua")}>
                  <Download className="size-4" aria-hidden />
                  Unduh Excel (CSV)
                </a>
                <Link href={`/cetak/rekap?${queryRekap(rekap.param)}`} target="_blank" className={buttonClass("utama")}>
                  <Printer className="size-4" aria-hidden />
                  Cetak / PDF
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">Peranmu hanya bisa melihat; cetak & ekspor oleh pengelola absensi.</p>
            )}
          </div>
          <div className="overflow-x-auto rounded-card bg-paper p-5 shadow-sm sm:p-8">
            <DokumenRekap rekap={rekap} />
          </div>
        </>
      )}
    </div>
  );
}
