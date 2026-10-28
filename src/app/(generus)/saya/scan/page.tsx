import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PemindaiQr } from "@/components/generus/pemindai-qr";
import { Skeleton } from "@/components/ui/skeleton";
import { JamRingkas, PeringatanSelisihJam } from "@/components/waktu/jam-server";
import { wajibGenerus } from "@/lib/generus/akun";

export const metadata: Metadata = {
  title: "Scan QR absen",
};

export default function ScanPage() {
  return (
    <div className="flex flex-col gap-4 pt-6 lg:max-w-2xl">
      <Link href="/saya" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Kembali
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Scan QR absen</h1>
        <JamRingkas />
      </div>
      <Suspense fallback={<Skeleton className="aspect-square w-full" />}>
        <Pemindai />
      </Suspense>
      <p className="px-1 text-sm text-muted">Waktu hadir dicatat menurut jam server (WIB), bukan jam perangkat ini.</p>
      <PeringatanSelisihJam />
    </div>
  );
}

async function Pemindai() {
  await wajibGenerus({ bolehPinAwal: true });
  return <PemindaiQr />;
}
