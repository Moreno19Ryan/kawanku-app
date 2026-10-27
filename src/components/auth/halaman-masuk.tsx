import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BellRing, CalendarDays, ChartColumn, ClipboardCheck, QrCode, Users } from "lucide-react";
import { LogoDesa } from "@/components/brand/logo-desa";
import { TombolTema } from "@/components/tema/tombol-tema";
import { PanelBantuan } from "./panel-bantuan";
import { SalamWaktu } from "./salam-waktu";

export type JenisMasuk = "generus" | "admin";

const ISI = {
  generus: {
    judul: "Absen, jadwal, dan kabar pengajian dalam satu genggaman.",
    keterangan: "Silakan masuk dengan username dan PIN dari admin kelompok.",
    fitur: [
      { ikon: QrCode, teks: "Absen pakai QR" },
      { ikon: BellRing, teks: "Pengingat otomatis" },
      { ikon: ChartColumn, teks: "Rapor kehadiran" },
    ],
  },
  admin: {
    judul: "Ruang kerja pengurus desa, kelompok, dan generus.",
    keterangan: "Khusus admin desa, kelompok, dan generus.",
    fitur: [
      { ikon: Users, teks: "Data jamaah" },
      { ikon: ClipboardCheck, teks: "Absensi & laporan" },
      { ikon: CalendarDays, teks: "Kegiatan & jadwal" },
    ],
  },
} as const;

/** Pola huruf "K" samar di panel biru (hiasan, bukan logo). */
function PolaK({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 520 520" className={`pointer-events-none absolute fill-white opacity-[0.13] ${className}`}>
      <path d="M60 60H130V460H60Z" />
      <path d="M130 260 330 60H460L260 260Z" />
      <path d="M130 260 330 460H460L260 260Z" />
    </svg>
  );
}

/** Logo KawanKu varian untuk latar gelap/biru (tulisan terang). */
function LogoPutih({ height }: { height: number }) {
  return (
    <span className="inline-flex p-[0.5em]" style={{ fontSize: height }}>
      <Image src="/brand/logo-horizontal-dark.svg" alt="KawanKu" width={Math.round((height * 458.4) / 68)} height={height} priority />
    </span>
  );
}

/**
 * Halaman masuk gaya One UI (docs/pedoman-desain.md): panel biru sambutan
 * (HP: di atas & melengkung, kartu form menumpuk; laptop: kolom kiri) dan
 * form di area sentuh. Dipakai /masuk (generus) dan /login (admin).
 */
export function HalamanMasuk({ jenis, children }: { jenis: JenisMasuk; children: ReactNode }) {
  const isi = ISI[jenis];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative overflow-hidden rounded-b-[2.25rem] bg-primary px-gutter pt-5 pb-24 text-white dark:bg-primary-soft lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:p-14">
        <PolaK className="-right-24 top-10 size-80 lg:-right-36 lg:top-auto lg:-bottom-32 lg:size-[32rem]" />
        <div className="relative flex items-center justify-between">
          <div className="-m-[14px]">
            <LogoPutih height={28} />
          </div>
          <TombolTema className="text-white! hover:bg-white/15! lg:hidden" />
        </div>

        <div className="kk-muncul relative mt-8 flex max-w-lg flex-col gap-3 lg:mt-0 lg:gap-5">
          <SalamWaktu className="text-sm text-white/80 lg:text-base" />
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight lg:text-[2.5rem]">{isi.judul}</h1>
          <ul className="mt-3 hidden flex-wrap gap-2.5 lg:flex">
            {isi.fitur.map(({ ikon: Ikon, teks }) => (
              <li key={teks} className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3.5 py-2 text-sm font-medium">
                <Ikon className="size-4" aria-hidden />
                {teks}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden items-center justify-between gap-4 lg:flex">
          <LogoDesa variant="horizontal" height={32} tone="dark" />
          <span className="text-sm text-white/80">Aplikasi Desa Kartika Wanasari</span>
        </div>
      </section>

      <main className="relative -mt-16 flex flex-col px-gutter pb-6 lg:mt-0 lg:min-h-dvh lg:justify-center lg:py-12">
        <TombolTema className="absolute top-6 right-6 hidden lg:flex" />
        <div className="kk-muncul-2 mx-auto w-full max-w-md">
          <div className="rounded-card bg-surface p-5 shadow-[0_8px_24px_rgb(20_22_28/0.08)] sm:p-7 lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none">
            <div className="mb-5 hidden lg:block">
              <h2 className="text-3xl font-semibold tracking-tight">Masuk</h2>
              <p className="mt-1.5 text-muted">{isi.keterangan}</p>
            </div>
            <TabJenis jenis={jenis} />
            {children}
          </div>
          <div className="mt-4 flex justify-center">
            <PanelBantuan jenis={jenis} />
          </div>
        </div>

        <footer className="mt-auto flex justify-center pt-8 lg:hidden">
          <LogoDesa variant="horizontal" height={28} />
        </footer>
      </main>
    </div>
  );
}

/** Tab bersegmen Generus | Admin (pindah antara /masuk dan /login). */
function TabJenis({ jenis }: { jenis: JenisMasuk }) {
  const tab = [
    { nilai: "generus", label: "Generus", href: "/masuk" },
    { nilai: "admin", label: "Admin", href: "/login" },
  ] as const;
  return (
    <nav aria-label="Jenis akun" className="grid grid-cols-2 gap-1 rounded-pill bg-surface-muted p-1">
      {tab.map((t) =>
        t.nilai === jenis ? (
          <span
            key={t.nilai}
            aria-current="page"
            className="flex h-11 items-center justify-center rounded-pill bg-surface font-semibold shadow-[0_1px_3px_rgb(20_22_28/0.12)] dark:bg-border"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.nilai}
            href={t.href}
            replace
            className="flex h-11 items-center justify-center rounded-pill font-medium text-muted transition-colors duration-200 ease-oneui hover:text-fg"
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}
