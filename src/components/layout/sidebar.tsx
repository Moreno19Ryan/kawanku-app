"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TombolTema } from "@/components/tema/tombol-tema";
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS, isActive, isSegera } from "./nav-items";

/**
 * Navigasi samping, tampil di layar ≥ lg (laptop). `akun` = slot info admin
 * (Server Component dari layout).
 */
export function Sidebar({ akun, terbuka = [] }: { akun?: ReactNode; terbuka?: string[] }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col gap-6 px-4 py-6 lg:flex">
      <div className="flex items-center justify-between">
        <BrandMark />
        <TombolTema />
      </div>

      {/* usePathname di dalam Suspense: di rute dinamis (mis. /jamaah/[id])
          path baru diketahui saat runtime (cacheComponents). */}
      <Suspense fallback={<MenuSamping pathname="" terbuka={terbuka} />}>
        <MenuSampingAktif terbuka={terbuka} />
      </Suspense>

      {akun && <div className="mt-auto">{akun}</div>}
    </aside>
  );
}

function MenuSampingAktif({ terbuka }: { terbuka: string[] }) {
  return <MenuSamping pathname={usePathname()} terbuka={terbuka} />;
}

function MenuSamping({ pathname, terbuka }: { pathname: string; terbuka: string[] }) {
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        if (isSegera(item, terbuka)) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-pill px-4 py-3 text-[0.95rem] text-muted/70"
            >
              <Icon className="size-5" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium">
                Segera
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-pill px-4 py-3 text-[0.95rem] font-medium transition-colors duration-200 ease-oneui ${
              active
                ? "bg-primary-soft text-primary"
                : "text-fg hover:bg-surface-muted"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
