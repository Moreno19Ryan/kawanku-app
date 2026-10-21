import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { DokumenRekap } from "@/components/absensi/dokumen-rekap";
import { TombolCetak } from "@/components/absensi/tombol-cetak";
import { buttonClass } from "@/components/ui/button";
import { bacaParamRekap, getRekap, queryRekap } from "@/lib/absensi/rekap";

export const metadata: Metadata = {
  title: "Cetak rekap absensi",
  robots: { index: false },
};

/** Lembar cetak rekap absensi (di luar layout admin). Bulanan = A4 mendatar. */
export default function CetakRekapPage({ searchParams }: PageProps<"/cetak/rekap">) {
  return (
    <div className="min-h-dvh bg-paper px-gutter py-8 text-paper-fg print:p-0">
      <Suspense fallback={<p className="text-sm">Menyiapkan rekap…</p>}>
        <Lembar cari={searchParams} />
      </Suspense>
    </div>
  );
}

async function Lembar({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const param = bacaParamRekap(await cari);
  const rekap = await getRekap(param, { ekspor: true });
  if (!rekap) return <p className="text-sm">Kamu tidak punya izin mencetak rekap absensi.</p>;
  if ("galat" in rekap) return <p className="text-sm">{rekap.galat}</p>;

  return (
    <div className={`mx-auto flex flex-col gap-6 ${param.jenis === "bulan" ? "max-w-[277mm]" : "max-w-[190mm]"} print:max-w-none`}>
      <style>{`@page { size: A4 ${param.jenis === "bulan" ? "landscape" : "portrait"}; margin: 10mm; }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-paper-muted">
          Pratinjau cetak. Pilih &ldquo;Simpan sebagai PDF&rdquo; di jendela cetak untuk membuat PDF.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/rekap?${queryRekap(rekap.param)}`} className={buttonClass("netral")}>
            <Download className="size-4" aria-hidden />
            Unduh Excel (CSV)
          </a>
          <TombolCetak />
        </div>
      </div>
      <DokumenRekap rekap={rekap} dicetak={new Date().toISOString()} />
    </div>
  );
}
