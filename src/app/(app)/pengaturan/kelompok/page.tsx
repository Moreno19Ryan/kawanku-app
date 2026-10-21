import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormUbahNama } from "@/components/pengaturan/form-ubah-nama";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";
import { ubahNamaKelompok, ubahStatusKelompok } from "@/lib/pengaturan/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Kelompok",
};

export default function KelompokPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Kelompok"
        description="Nama resmi tiap kelompok tampil di seluruh aplikasi dan dokumen."
      />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <DaftarKelompok />
      </Suspense>
    </>
  );
}

async function DaftarKelompok() {
  await wajibIzin("kelompok.kelola");
  const supabase = await createClient();
  const { data: kelompok } = await supabase
    .from("kelompok")
    .select("id, nomor, nama, aktif")
    .order("nomor");

  if (!kelompok) {
    return <Card className="text-sm text-danger">Gagal memuat kelompok. Muat ulang halaman.</Card>;
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {kelompok.map((k) => (
        <li key={k.id}>
          <Card className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold">
                Kelompok {k.nomor}
                <Badge nada={k.aktif ? "sukses" : "bahaya"}>{k.aktif ? "Aktif" : "Nonaktif"}</Badge>
              </p>
              <TombolAksi
                aksi={ubahStatusKelompok.bind(null, k.id, !k.aktif)}
                label={k.aktif ? "Nonaktifkan" : "Aktifkan"}
                varian={k.aktif ? "netral" : "kedua"}
                konfirmasi={
                  k.aktif
                    ? `Nonaktifkan ${k.nama}? Kelompok ini tidak bisa dipilih untuk peran admin baru.`
                    : undefined
                }
              />
            </div>
            <FormUbahNama
              aksi={ubahNamaKelompok.bind(null, k.id)}
              nama={k.nama}
              label={`Nama kelompok ${k.nomor}`}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}
