import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormKataSandi } from "@/components/pengaturan/form-kata-sandi";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolKeluarSemua } from "@/components/pengaturan/tombol-keluar-semua";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { labelPenugasan, wajibAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Akun saya",
};

export default function AkunPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader title="Akun saya" />

      <div className="flex flex-col gap-4 sm:gap-6">
        <Suspense fallback={<Skeleton className="h-36" />}>
          <ProfilAkun />
        </Suspense>

        <Card>
          <h2 className="text-lg font-semibold">Ganti kata sandi</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Masukkan kata sandi lama untuk memastikan ini memang kamu.
          </p>
          <FormKataSandi />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Keamanan sesi</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Pernah login di perangkat orang lain, atau HP hilang? Keluarkan akunmu dari semua
            perangkat sekaligus, lalu login lagi di perangkat ini.
          </p>
          <TombolKeluarSemua />
        </Card>
      </div>
    </>
  );
}

async function ProfilAkun() {
  const admin = await wajibAdmin();

  return (
    <Card>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Nama</dt>
          <dd className="mt-0.5 font-medium">{admin.nama}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Email</dt>
          <dd className="mt-0.5 font-medium break-all">{admin.email ?? "–"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Peran</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {admin.penugasan.map((p) => (
              <Badge key={labelPenugasan(p)} nada="utama">
                {labelPenugasan(p)}
              </Badge>
            ))}
          </dd>
        </div>
      </dl>
      <p className="mt-5 text-xs text-muted">
        Nama dan peran diatur oleh admin yang mengelola akses.
      </p>
    </Card>
  );
}
