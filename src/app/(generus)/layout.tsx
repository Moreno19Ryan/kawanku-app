import { Suspense, ViewTransition } from "react";
import { LogOut } from "lucide-react";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { AkunGenerus } from "@/components/generus/akun-generus";
import { MenuSampingGenerus } from "@/components/generus/menu-samping-generus";
import { NavGenerus } from "@/components/generus/nav-generus";
import { SegarkanLangsung } from "@/components/sistem/segarkan-langsung";
import { TombolTema } from "@/components/tema/tombol-tema";
import { keluarGenerus } from "@/lib/generus/actions";

/**
 * Kerangka halaman jamaah (generus), dua versi: HP/tablet = kepala atas +
 * menu bawah; laptop/PC (lg) = menu samping seperti area admin, isi
 * melebar. Halaman sambutan (Beranda) membawa kepala sendiri di panel biru
 * (`data-sambutan`, kepala biasa disembunyikan); halaman tanpa menu (Ganti
 * PIN awal) menandai dirinya `data-tanpa-menu`.
 */
export default function GenerusLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="group/generus flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex group-has-[[data-sambutan]]/generus:hidden items-center lg:hidden lg:group-has-[[data-tanpa-menu]]/generus:flex justify-between bg-bg/85 px-2 pr-gutter backdrop-blur-lg">
        <BrandMark height={24} />
        <div className="flex items-center gap-1">
          <TombolTema />
          <form action={keluarGenerus}>
            <button
              type="submit"
              aria-label="Keluar"
              title="Keluar"
              className="flex size-10 items-center justify-center rounded-pill text-muted transition-colors duration-200 ease-oneui hover:bg-surface-muted hover:text-fg"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <MenuSampingGenerus
        akun={
          <Suspense fallback={<div className="h-16 rounded-card bg-surface" />}>
            <AkunGenerus />
          </Suspense>
        }
      />
      <ViewTransition update={{ diam: "none", default: "kk-halaman" }} default="none">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-gutter pb-8 lg:mr-0 lg:ml-sidebar lg:w-auto lg:max-w-6xl lg:px-10 lg:group-has-[[data-tanpa-menu]]/generus:mx-auto lg:group-has-[[data-tanpa-menu]]/generus:max-w-lg">
          {children}
        </main>
      </ViewTransition>
      <AppFooter className="mx-auto mt-6 w-full max-w-lg px-gutter pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom)+1.5rem)] lg:mr-0 lg:ml-sidebar lg:w-auto lg:max-w-6xl lg:px-10 lg:pb-8 lg:group-has-[[data-tanpa-menu]]/generus:mx-auto lg:group-has-[[data-tanpa-menu]]/generus:max-w-lg" />
      <NavGenerus />
      <SegarkanLangsung />
    </div>
  );
}
