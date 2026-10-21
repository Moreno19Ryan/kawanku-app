import { LogOut } from "lucide-react";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { TombolTema } from "@/components/tema/tombol-tema";
import { keluarGenerus } from "@/lib/generus/actions";

/** Kerangka halaman generus: ringkas, nyaman di HP, tanpa menu admin. */
export default function GenerusLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-bg/85 px-2 pr-gutter backdrop-blur-lg">
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
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-gutter pb-8">{children}</main>
      <AppFooter className="mx-auto mt-6 w-full max-w-lg px-gutter pb-6" />
    </div>
  );
}
