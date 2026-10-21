import type { Metadata } from "next";
import Link from "next/link";
import { BarisKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { FormMasukGenerus } from "@/components/generus/form-masuk-generus";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { TombolTema } from "@/components/tema/tombol-tema";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masuk Generus",
};

/** Login generus (username + PIN dari admin). */
export default function GenerusLoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col px-gutter py-10">
      <TombolTema className="absolute top-4 right-4" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandMark height={36} />
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Masuk Generus</h1>
          <p className="mt-1 text-sm text-muted">Assalamu&apos;alaikum. Silakan masuk untuk absen dengan scan QR di layar admin.</p>
          <FormMasukGenerus />
        </Card>

        <div className="mt-5 flex flex-col gap-2 px-1 text-center">
          <p className="text-sm text-muted">
            Belum punya akun atau lupa PIN? Minta ke admin kelompokmu.
          </p>
          <p className="text-sm text-muted">
            Admin?{" "}
            <Link href="/login" className="font-medium text-primary">
              Masuk admin
            </Link>
          </p>
          <BarisKontakPengembang awalan="Aplikasi bermasalah?" />
        </div>
      </div>
      <AppFooter className="mx-auto mt-10 w-full max-w-3xl" />
    </div>
  );
}
