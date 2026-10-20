import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BAGIAN_PENGATURAN } from "@/components/pengaturan/bagian";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { punyaIzin, wajibAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default function PengaturanPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Akun, admin, dan data dasar desa." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <DaftarBagian />
      </Suspense>
    </>
  );
}

async function DaftarBagian() {
  const admin = await wajibAdmin();
  const bagian = BAGIAN_PENGATURAN.filter((b) => !b.izin || punyaIzin(admin, b.izin));

  return (
    <nav aria-label="Bagian pengaturan" className="overflow-hidden rounded-card bg-surface">
      <ul className="divide-y divide-border">
        {bagian.map((b) => {
          const Icon = b.icon;
          const isi = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{b.judul}</span>
                <span className="block truncate text-sm text-muted">{b.keterangan}</span>
              </span>
              {b.segera ? (
                <Badge>Segera</Badge>
              ) : (
                <ChevronRight className="size-5 text-muted" aria-hidden />
              )}
            </>
          );

          return (
            <li key={b.href}>
              {b.segera ? (
                <span aria-disabled="true" className="flex items-center gap-4 px-5 py-4 opacity-60">
                  {isi}
                </span>
              ) : (
                <Link
                  href={b.href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
                >
                  {isi}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
