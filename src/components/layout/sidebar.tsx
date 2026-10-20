"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Navigasi samping, tampil di layar ≥ lg (laptop). `akun` = slot info admin
 * (Server Component dari layout).
 */
export function Sidebar({ akun }: { akun?: ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col gap-6 px-4 py-6 lg:flex">
      <div>
        <BrandMark />
      </div>

      <nav aria-label="Menu utama" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          if (item.soon) {
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

      {akun && <div className="mt-auto">{akun}</div>}
    </aside>
  );
}
