import { BottomNav } from "@/components/layout/bottom-nav";
import { AppFooter } from "@/components/layout/app-footer";
import { BrandMark } from "@/components/layout/brand-mark";
import { Sidebar } from "@/components/layout/sidebar";

/** Kerangka area admin: sidebar di desktop, bottom nav di HP. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Sidebar />

      <div className="sticky top-0 z-10 flex items-center bg-bg/85 px-2 backdrop-blur-lg lg:hidden">
        <BrandMark height={24} />
      </div>

      {/* Konten flex-1 mendorong footer ke paling bawah walau isi halaman pendek. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-gutter pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom)+1.5rem)] lg:ml-sidebar lg:mr-0 lg:w-auto lg:px-10 lg:pb-8">
        <div className="flex-1">{children}</div>
        <AppFooter className="mt-12" />
      </main>

      <BottomNav />
    </div>
  );
}
