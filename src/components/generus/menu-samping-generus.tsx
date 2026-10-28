"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { TombolTema } from "@/components/tema/tombol-tema";
import { MENU_GENERUS, aktifGenerus } from "./nav-generus";

/**
 * Menu samping area jamaah di laptop/PC (≥ lg), padanan NavGenerus di HP;
 * gaya sama dengan menu samping admin. `akun` = slot info akun (Server
 * Component dari layout, di dalam Suspense). Tidak tampil di Ganti PIN.
 */
export function MenuSampingGenerus({ akun }: { akun?: ReactNode }) {
  // usePathname di dalam Suspense: path rute dinamis baru diketahui saat runtime.
  return (
    <Suspense fallback={<Samping pathname="" akun={akun} />}>
      <SampingAktif akun={akun} />
    </Suspense>
  );
}

function SampingAktif({ akun }: { akun?: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/saya/pin") return null;
  return <Samping pathname={pathname} akun={akun} />;
}

function Samping({ pathname, akun }: { pathname: string; akun?: ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col gap-6 px-4 py-6 lg:flex">
      <div className="flex items-center justify-between">
        <BrandMark />
        <TombolTema />
      </div>
      <nav aria-label="Menu jamaah" className="flex flex-col gap-1">
        {MENU_GENERUS.map((m) => {
          const Icon = m.icon;
          const nyala = aktifGenerus(pathname, m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={nyala ? "page" : undefined}
              className={`flex items-center gap-3 rounded-pill px-4 py-3 text-[0.95rem] font-medium transition-colors duration-200 ease-oneui ${
                nyala ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-muted"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {m.href === "/saya/scan" ? "Scan QR" : m.label}
            </Link>
          );
        })}
      </nav>
      {akun && <div className="mt-auto">{akun}</div>}
    </aside>
  );
}
