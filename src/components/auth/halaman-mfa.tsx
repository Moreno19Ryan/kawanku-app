import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { keluar } from "@/lib/auth/actions";

/** Kerangka halaman verifikasi dua langkah: logo, kartu di tengah, tombol keluar. */
export function HalamanMfa({ judul, keterangan, children }: { judul: string; keterangan: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-gutter py-8">
      <BrandMark height={28} />
      <div className="kk-muncul mt-6 w-full max-w-md rounded-card bg-surface p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{judul}</h1>
        <p className="mt-1.5 text-sm text-muted">{keterangan}</p>
        <div className="mt-6">{children}</div>
      </div>
      <form action={keluar} className="mt-4">
        <button type="submit" className="rounded-pill px-4 py-2 text-sm font-medium text-muted hover:text-fg">
          Keluar
        </button>
      </form>
    </main>
  );
}
