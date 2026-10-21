import type { Metadata } from "next";
import { Suspense } from "react";
import { FormJamaah } from "@/components/jamaah/form-jamaah";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { KembaliKeJamaah } from "@/components/jamaah/kembali";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tambahJamaah } from "@/lib/jamaah/actions";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";

export const metadata: Metadata = {
  title: "Tambah jamaah",
};

export default function TambahJamaahPage() {
  return (
    <>
      <KembaliKeJamaah />
      <PageHeader
        title="Tambah jamaah"
        description="Kode jamaah (KW-…) dibuat otomatis setelah disimpan."
      />
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <IsiTambah />
      </Suspense>
    </>
  );
}

async function IsiTambah() {
  const [akses, aturan] = await Promise.all([getAksesJamaah(), getAturanKategori()]);
  if (!akses || akses.kelompokTambah.length === 0) return <JamaahBelumMenyala />;

  return (
    <Card>
      <FormJamaah
        aksi={tambahJamaah}
        kelompok={akses.kelompokTambah}
        aturan={aturan}
        labelKirim="Simpan jamaah"
      />
      <p className="mt-5 text-xs text-muted">
        Tidak ada NIK, alamat, atau nomor HP: data sensitif belum disimpan sampai pengurus
        memutuskan aturannya.
      </p>
    </Card>
  );
}
