import type { Metadata } from "next";
import { BarisKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { Card } from "@/components/ui/card";
import { TombolTema } from "@/components/tema/tombol-tema";
import { FormMasuk } from "@/components/auth/form-masuk";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Masuk Admin",
};

/**
 * Login admin (email + kata sandi, Supabase Auth). Login generus (username +
 * PIN) ada di /masuk.
 */
export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col px-gutter py-10">
      <TombolTema className="absolute top-4 right-4" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandMark height={36} />
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Masuk Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Assalamu&apos;alaikum. Khusus admin desa, kelompok, dan generus.
          </p>

          <FormMasuk />
        </Card>

        <div className="mt-5 flex flex-col gap-2 px-1 text-center">
          <p className="text-sm text-muted">
            Lupa kata sandi? Minta atur ulang ke admin yang mengelola akunmu.
          </p>
          <p className="text-sm text-muted">
            Generus?{" "}
            <Link href="/masuk" className="font-medium text-primary">
              Masuk generus
            </Link>
          </p>
          <BarisKontakPengembang awalan="Aplikasi bermasalah?" />
        </div>
      </div>

      {/* Identitas desa cukup di footer. */}
      <AppFooter className="mx-auto mt-10 w-full max-w-3xl" />
    </div>
  );
}
