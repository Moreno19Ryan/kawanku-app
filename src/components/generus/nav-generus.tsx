"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumn, House, ScanLine, UserRound } from "lucide-react";

const MENU = [
  { href: "/saya", label: "Beranda", icon: House },
  { href: "/saya/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/saya/scan", label: "Scan", icon: ScanLine, utama: true },
  { href: "/saya/kehadiran", label: "Kehadiran", icon: ChartNoAxesColumn },
  { href: "/saya/profil", label: "Profil", icon: UserRound },
] as const;

const aktif = (pathname: string, href: string) =>
  href === "/saya" ? pathname === "/saya" : pathname === href || pathname.startsWith(`${href}/`);

/** Navigasi bawah area generus (HP), dengan tombol Scan menonjol di tengah. */
export function NavGenerus() {
  return (
    <nav
      aria-label="Menu generus"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
    >
      {/* usePathname di dalam Suspense: path rute dinamis baru diketahui saat runtime. */}
      <Suspense fallback={<Menu pathname="" />}>
        <MenuAktif />
      </Suspense>
    </nav>
  );
}

function MenuAktif() {
  return <Menu pathname={usePathname()} />;
}

function Menu({ pathname }: { pathname: string }) {
  return (
    <ul className="mx-auto flex h-bottomnav max-w-lg items-stretch justify-around px-2">
      {MENU.map((m) => {
        const Icon = m.icon;
        const nyala = aktif(pathname, m.href);
        return (
          <li key={m.href} className="flex flex-1">
            <Link
              href={m.href}
              aria-current={nyala ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 ${nyala ? "text-primary" : "text-muted"}`}
            >
              {"utama" in m ? (
                <span className="-mt-5 flex size-12 items-center justify-center rounded-pill bg-primary text-primary-fg shadow-lg ring-4 ring-bg">
                  <Icon className="size-6" aria-hidden />
                </span>
              ) : (
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-pill transition-colors duration-200 ease-oneui ${
                    nyala ? "bg-primary-soft text-primary" : ""
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
              )}
              <span className="text-[0.7rem] font-medium">{m.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
