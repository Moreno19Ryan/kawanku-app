import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { LayarQr } from "@/components/absensi/layar-qr";
import { BrandMark } from "@/components/layout/brand-mark";
import { JamLayar } from "@/components/waktu/jam-server";
import { jamAbsensi } from "@/lib/absensi/jendela";
import { bolehCatatSesi, getAksesAbsensi, KOLOM_SESI, type Sesi } from "@/lib/absensi/akses";
import { hadirLayar, tokenLayar } from "@/lib/absensi/actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "QR absen",
  robots: { index: false },
};

/** Layar QR absen jalur 2 (untuk laptop/proyektor), di luar layout admin. */
export default function LayarPage({ params }: PageProps<"/layar/[id]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-gutter py-6">
      <Suspense fallback={<p className="text-center text-muted">Memuat…</p>}>
        <Layar params={params} />
      </Suspense>
    </div>
  );
}

async function Layar({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, akses] = await Promise.all([params, getAksesAbsensi()]);
  if (!akses) return <p className="text-center">Masuk sebagai admin untuk menampilkan QR absen.</p>;
  const supabase = await createClient();
  const { data: sesi } = await supabase.from("sesi_absensi").select(KOLOM_SESI).eq("id", id).maybeSingle<Sesi>();
  if (!sesi) notFound();
  if (!bolehCatatSesi(akses, sesi)) return <p className="text-center">Mohon maaf, akun ini tidak berwenang mencatat di sesi ini.</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/absensi/${sesi.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="size-4" aria-hidden />
          Kembali
        </Link>
        <BrandMark height={28} />
      </div>
      <LayarQr
        sesiId={sesi.id}
        ambil={tokenLayar.bind(null, sesi.id)}
        hitung={hadirLayar.bind(null, sesi.id)}
        judul={
          <>
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{sesi.nama}</h1>
            <p className="mt-1 text-muted lg:text-lg">{tanggalJam(sesi.mulai)}</p>
          </>
        }
        jam={<JamLayar {...jamAbsensi(sesi)} />}
      />
    </div>
  );
}
