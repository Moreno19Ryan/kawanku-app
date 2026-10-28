import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { AkunAdmin } from "@/components/auth/akun-admin";
import { PanelSambutan } from "@/components/layout/panel-sambutan";
import { BannerPengumuman } from "@/components/sistem/banner-pengumuman";
import { TombolTema } from "@/components/tema/tombol-tema";
import { Card } from "@/components/ui/card";
import { salamWaktu } from "@/lib/generus/sambutan";

/**
 * Kerangka Beranda area admin (admin & pengembang), docs/pedoman-desain.md:
 * kepala (panel sambutan + kartu mengambang + pengumuman), kolom samping
 * (laptop: kanan; HP: di bawah kepala) dan badan (angka & rincian).
 */
export function TataBeranda({
  panel,
  mengambang,
  samping,
  badan,
}: {
  panel: ReactNode;
  mengambang: ReactNode;
  samping: ReactNode;
  badan: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start">
      <div className="flex flex-col">
        {panel}
        {/* Kartu yang mengambang di tepi bawah panel. */}
        <div className="kk-muncul-2 relative -mt-16 sm:mx-4 lg:-mt-20 lg:mx-6 [&>*]:shadow-[0_8px_28px_rgb(0_0_0/0.10)]">
          {mengambang}
        </div>
        {/* Pengumuman di bawah kartu, sama dengan Beranda generus. */}
        <div className="mt-4 empty:hidden [&>div]:mt-0">
          <Suspense fallback={null}>
            <BannerPengumuman />
          </Suspense>
        </div>
      </div>

      <aside className="flex flex-col gap-4 sm:gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-6">
        {samping}
      </aside>

      <div className="flex flex-col gap-4 sm:gap-6">{badan}</div>
    </div>
  );
}

/** Panel sambutan Beranda admin: salam, nama, peran, satu kalimat ringkas. */
export function PanelAdmin({ nama, peran, kalimat }: { nama: string; peran: string; kalimat: string | null }) {
  return (
    <PanelSambutan
      kepalaLaptop={false}
      kanan={
        <>
          <TombolTema className="text-white! hover:bg-white/15!" />
          <Suspense fallback={<div className="size-8" />}>
            <AkunAdmin ringkas terang />
          </Suspense>
        </>
      }
    >
      <p className="text-sm text-white/80 lg:text-base">Assalamu&apos;alaikum · {salamWaktu()}</p>
      <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight lg:text-[2rem]">
        {nama.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-white/80 lg:text-base">{peran}</p>
      {kalimat && <p className="mt-4 rounded-card bg-white/15 px-4 py-3 text-sm font-medium lg:inline-block">{kalimat}</p>}
    </PanelSambutan>
  );
}

export type Pintasan = { href: string; label: string; ikon: LucideIcon; angka?: number };

/** HP: semua pintasan dalam satu baris (jumlahnya sesuai wewenang). */
const KOLOM_PINTASAN: Record<number, string> = {
  1: "grid-cols-2",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function DaftarPintasan({ pintasan }: { pintasan: Pintasan[] }) {
  if (pintasan.length === 0) return null;
  return (
    <nav
      aria-label="Pintasan"
      className={`grid gap-2 lg:grid-cols-2 lg:gap-3 lg:rounded-card lg:bg-surface lg:p-4 ${KOLOM_PINTASAN[pintasan.length] ?? "grid-cols-4"}`}
    >
      {pintasan.map(({ href, label, ikon: Ikon, angka }) => (
        <Link
          key={href}
          href={href}
          className="relative flex flex-col items-center gap-1.5 rounded-card bg-surface px-1 py-3 text-center text-xs font-medium transition-colors duration-200 ease-oneui hover:bg-surface-muted lg:items-start lg:bg-bg lg:p-3.5 lg:text-left lg:text-sm"
        >
          {(angka ?? 0) > 0 && (
            <span className="absolute top-1.5 right-2 flex h-5 min-w-5 items-center justify-center rounded-pill bg-warning px-1.5 text-[0.7rem] font-bold text-white">
              {angka}
            </span>
          )}
          <span className="flex size-10 items-center justify-center rounded-pill bg-primary-soft text-primary">
            <Ikon className="size-[1.125rem]" aria-hidden />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export type Perhatian = { href: string; teks: string; penting?: boolean };

export function DaftarPerhatian({ perhatian }: { perhatian: Perhatian[] }) {
  return (
    <section className="flex flex-col gap-2 lg:rounded-card lg:bg-surface lg:p-5">
      <h2 className="px-1 text-sm font-semibold text-muted lg:px-0 lg:text-lg lg:text-fg">Perlu perhatian</h2>
      {perhatian.length === 0 ? (
        <p className="rounded-card bg-surface px-5 py-4 text-sm text-muted lg:p-0">
          Alhamdulillah, tidak ada yang perlu ditindaklanjuti.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface lg:rounded-none">
          {perhatian.map((p) => (
            <li key={p.teks}>
              <Link
                href={p.href}
                className="flex min-h-13 items-center gap-3 px-5 py-3 text-sm transition-colors duration-200 ease-oneui hover:bg-surface-muted lg:px-0 lg:hover:bg-transparent lg:hover:text-primary"
              >
                <span className={`size-2 shrink-0 rounded-pill ${p.penting ? "bg-warning" : "bg-primary"}`} aria-hidden />
                <span className="min-w-0 flex-1">{p.teks}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Angka utama (stat tile). */
export function Angka({
  label,
  nilai,
  keterangan,
  href,
}: {
  label: string;
  nilai: number;
  keterangan?: string;
  href?: string;
}) {
  const isi = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{nilai.toLocaleString("id-ID")}</p>
      {keterangan && <p className="text-xs text-muted">{keterangan}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-card bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors duration-200 ease-oneui hover:bg-surface-muted sm:p-6"
    >
      {isi}
    </Link>
  ) : (
    <Card className="flex flex-col gap-1.5">{isi}</Card>
  );
}
