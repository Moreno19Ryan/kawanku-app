import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FormKodeMfa } from "@/components/auth/form-kode-mfa";
import { HalamanMfa } from "@/components/auth/halaman-mfa";
import { Skeleton } from "@/components/ui/skeleton";
import { keadaanMfa } from "@/lib/auth/mfa";
import { tujuanAman } from "@/lib/auth/tujuan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verifikasi dua langkah",
};

/** Setelah kata sandi benar: minta kode 6 angka dari aplikasi authenticator. */
export default function MfaPage({ searchParams }: PageProps<"/mfa">) {
  return (
    <HalamanMfa
      judul="Verifikasi dua langkah"
      keterangan="Mohon masukkan kode 6 angka dari aplikasi authenticator di HP."
    >
      <Suspense fallback={<Skeleton className="h-24" />}>
        <Isi cari={searchParams} />
      </Suspense>
    </HalamanMfa>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const tujuan = tujuanAman((await cari).next);
  const mfa = await keadaanMfa(await createClient());
  if (!mfa.perluKode) redirect(tujuan);
  return <FormKodeMfa tujuan={tujuan} />;
}
