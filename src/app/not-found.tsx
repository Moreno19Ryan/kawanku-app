import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
};

/** Halaman 404: alamat salah, data sudah dihapus, atau tautan tidak lengkap. */
export default function TidakDitemukan() {
  return (
    <div className="flex min-h-dvh flex-col px-gutter py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandMark height={36} />
        </div>
        <Card className="p-6 text-center sm:p-8">
          <p className="text-sm font-medium text-primary">404</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted">
            Alamatnya mungkin salah, datanya sudah dihapus, atau tautannya tidak lengkap. Silakan kembali ke beranda.
          </p>
          <Link href="/" className={buttonClass("utama", "mt-5")}>
            Kembali ke beranda
          </Link>
        </Card>
      </div>
      <AppFooter className="mx-auto mt-10 w-full max-w-3xl" />
    </div>
  );
}
