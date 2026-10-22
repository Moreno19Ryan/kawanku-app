import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HasilAbsen } from "@/components/generus/hasil-absen";
import { wajibGenerus } from "@/lib/generus/akun";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Absen",
};

/** Tujuan QR layar (/absen?t=...). Bisa dibuka dari aplikasi kamera HP. */
export default function AbsenPage({ searchParams }: PageProps<"/absen">) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Absen</h1>
      <Suspense fallback={<Memuat className="h-64" />}>
        <Absen cari={searchParams} />
      </Suspense>
    </div>
  );
}

async function Absen({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [generus, param] = await Promise.all([wajibGenerus({ bolehPinAwal: true }), cari]);
  const t = Array.isArray(param.t) ? param.t[0] : param.t;
  return (
    <>
      {t ? (
        <HasilAbsen token={t} />
      ) : (
        <p className="text-sm text-muted">Tidak ada QR. Scan QR di layar admin dari menu Scan QR absen.</p>
      )}
      {generus.pinAwal && (
        <p className="rounded-card bg-primary-soft px-4 py-3 text-sm text-primary">
          Kamu masih memakai PIN awal.{" "}
          <Link href="/saya/pin" className="font-semibold underline">
            Ganti PIN sekarang
          </Link>
        </p>
      )}
    </>
  );
}
