import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { DaftarPengajuan } from "@/components/absensi/daftar-pengajuan";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { getPengajuanIzin } from "@/lib/absensi/izin";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Pengajuan Izin",
};

export default function PengajuanIzinPage() {
  return (
    <>
      <Link href="/absensi" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <PageHeader
        title="Pengajuan izin"
        description="Izin dan sakit yang diajukan generus dari HP-nya. Yang disetujui otomatis tercatat di absensi pertemuannya."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <Daftar />
      </Suspense>
    </>
  );
}

async function Daftar() {
  const akses = await getAksesAbsensi();
  if (!akses?.bolehLihat) return <AbsensiBelumMenyala />;
  const semua = await getPengajuanIzin({});
  const menunggu = semua.filter((p) => p.status === "menunggu");
  const sudah = semua
    .filter((p) => p.status !== "menunggu")
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 30);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted">Menunggu · {menunggu.length}</h2>
        {menunggu.length === 0 ? (
          <Card className="text-center text-sm text-muted">Tidak ada pengajuan yang menunggu. 👍</Card>
        ) : (
          <DaftarPengajuan pengajuan={menunggu} />
        )}
      </section>
      {sudah.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">Sudah ditanggapi</h2>
          <DaftarPengajuan pengajuan={sudah} />
        </section>
      )}
    </div>
  );
}
