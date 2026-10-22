import { Suspense, ViewTransition } from "react";
import { AkunAdmin } from "@/components/auth/akun-admin";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { BottomNavTerbuka, SidebarTerbuka } from "@/components/layout/nav-terbuka";
import { Sidebar } from "@/components/layout/sidebar";
import { TombolTema } from "@/components/tema/tombol-tema";
import { BannerPengumuman } from "@/components/sistem/banner-pengumuman";
import { GerbangPerawatan } from "@/components/sistem/gerbang-perawatan";
import { SegarkanLangsung } from "@/components/sistem/segarkan-langsung";
import { Memuat } from "@/components/ui/memuat";

/**
 * Kerangka area admin: sidebar di desktop, bottom nav di HP.
 *
 * Proxy sudah menolak pengunjung tanpa sesi. Pemeriksaan "admin aktif"
 * ada di <AkunAdmin> (di dalam Suspense, karena membaca cookie); layout
 * sendiri tidak boleh await sesi di level atas (cacheComponents).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const akunSidebar = (
    <Suspense fallback={<div className="h-16 rounded-card bg-surface" />}>
      <AkunAdmin />
    </Suspense>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<Sidebar akun={akunSidebar} />}>
        <SidebarTerbuka akun={akunSidebar} />
      </Suspense>

      <div className="sticky top-0 z-10 flex items-center justify-between bg-bg/85 px-2 pr-gutter backdrop-blur-lg lg:hidden">
        <BrandMark height={24} />
        <div className="flex items-center gap-1">
          <TombolTema />
          <Suspense fallback={<div className="size-8" />}>
            <AkunAdmin ringkas />
          </Suspense>
        </div>
      </div>

      {/* Konten flex-1 mendorong footer ke paling bawah walau isi halaman pendek. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-gutter pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom)+1.5rem)] lg:ml-sidebar lg:mr-0 lg:w-auto lg:px-10 lg:pb-8">
        <Suspense fallback={null}>
          <BannerPengumuman />
        </Suspense>
        {/* Perpindahan halaman: isi memudar halus (globals.css, .kk-halaman). */}
        <ViewTransition update={{ diam: "none", default: "kk-halaman" }} default="none">
          <div className="flex-1">
            <Suspense fallback={<Memuat className="mt-10 h-64" />}>
              <GerbangPerawatan>{children}</GerbangPerawatan>
            </Suspense>
          </div>
        </ViewTransition>
        <AppFooter className="mt-12" />
      </main>

      <Suspense fallback={<BottomNav />}>
        <BottomNavTerbuka />
      </Suspense>
      <SegarkanLangsung />
    </div>
  );
}
