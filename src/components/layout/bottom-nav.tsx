"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive, isSegera } from "./nav-items";

/**
 * Navigasi bawah, tampil di layar < lg (HP/tablet). Gaya sama dengan menu
 * generus: tanpa garis atas, sudut membulat, Absensi menonjol di tengah.
 */
const URUTAN_BAWAH = ["/dashboard", "/jamaah", "/absensi", "/kegiatan", "/pengaturan"];
const TENGAH = "/absensi";

export function BottomNav({ terbuka = [] }: { terbuka?: string[] }) {
  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-20 rounded-t-[1.75rem] bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgb(0_0_0/0.07)] backdrop-blur-lg lg:hidden"
    >
      {/* usePathname di dalam Suspense (lihat Sidebar). */}
      <Suspense fallback={<MenuBawah pathname="" terbuka={terbuka} />}>
        <MenuBawahAktif terbuka={terbuka} />
      </Suspense>
    </nav>
  );
}

function MenuBawahAktif({ terbuka }: { terbuka: string[] }) {
  return <MenuBawah pathname={usePathname()} terbuka={terbuka} />;
}

function MenuBawah({ pathname, terbuka }: { pathname: string; terbuka: string[] }) {
  return (
    <ul className="mx-auto flex h-bottomnav max-w-xl items-stretch justify-around px-2">
      {URUTAN_BAWAH.map((href) => NAV_ITEMS.find((i) => i.href === href)!).map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const segera = isSegera(item, terbuka);
        const content = (
          <>
            {item.href === TENGAH && !segera ? (
              <span className="-mt-5 flex size-12 items-center justify-center rounded-pill bg-primary text-primary-fg shadow-lg ring-4 ring-bg">
                <Icon className="size-6" aria-hidden />
              </span>
            ) : (
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-pill transition-colors duration-200 ease-oneui ${
                  active ? "bg-primary-soft text-primary" : ""
                }`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            )}
            <span className={`text-[0.7rem] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
          </>
        );

        return (
          <li key={item.href} className="flex flex-1">
            {segera ? (
              <span
                aria-disabled="true"
                title="Segera"
                className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted/50"
              >
                {content}
              </span>
            ) : (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
