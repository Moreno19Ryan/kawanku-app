import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibAdmin } from "@/lib/auth/admin";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Kategori jamaah",
};

type BarisKategori = {
  id: string;
  urutan: number;
  nama: string;
  usia_min: number | null;
  usia_max: number | null;
  status_sekolah_berlaku: string[] | null;
  status_pernikahan_berlaku: string[] | null;
  termasuk_generus: boolean;
};

export default function KategoriPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Kategori jamaah"
        description="Kategori dihitung otomatis dari data jamaah. Aturan dicek dari atas; kategori pertama yang cocok yang dipakai."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarKategori />
      </Suspense>
    </>
  );
}

function syarat(k: BarisKategori): string[] {
  const hasil: string[] = [];
  if (k.status_sekolah_berlaku?.length) {
    hasil.push(
      `Status sekolah: ${k.status_sekolah_berlaku.map((s) => LABEL_STATUS_SEKOLAH[s] ?? s).join(", ")}`,
    );
  }
  if (k.status_pernikahan_berlaku?.length) {
    hasil.push(
      `Status pernikahan: ${k.status_pernikahan_berlaku.map((s) => LABEL_STATUS_PERNIKAHAN[s] ?? s).join(", ")}`,
    );
  }
  if (k.usia_min !== null && k.usia_max !== null) hasil.push(`Usia ${k.usia_min}–${k.usia_max} tahun`);
  else if (k.usia_min !== null) hasil.push(`Usia ${k.usia_min} tahun ke atas`);
  else if (k.usia_max !== null) hasil.push(`Usia sampai ${k.usia_max} tahun`);
  return hasil;
}

async function DaftarKategori() {
  await wajibAdmin();
  const supabase = await createClient();
  const { data: kategori } = await supabase
    .from("kategori_jamaah")
    .select(
      "id, urutan, nama, usia_min, usia_max, status_sekolah_berlaku, status_pernikahan_berlaku, termasuk_generus",
    )
    .order("urutan")
    .returns<BarisKategori[]>();

  if (!kategori) {
    return <Card className="text-sm text-danger">Gagal memuat kategori. Muat ulang halaman.</Card>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {kategori.map((k) => (
          <li key={k.id}>
            <Card className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-sm font-semibold text-muted">
                {k.urutan}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {k.nama}
                  {k.termasuk_generus && <Badge nada="utama">Generus</Badge>}
                </p>
                <ul className="mt-1 text-sm text-muted">
                  {syarat(k).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        Jamaah yang tidak cocok dengan aturan mana pun tampil sebagai &ldquo;tanpa kategori&rdquo;.
        Aturan dan angkanya masih DRAF dan akan diubah admin desa sesuai keputusan pengurus.
      </p>
    </div>
  );
}
