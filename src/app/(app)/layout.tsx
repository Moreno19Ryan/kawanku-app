import { BottomNav } from "@/components/layout/bottom-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { Sidebar } from "@/components/layout/sidebar";

/** Kerangka area admin: sidebar di desktop, bottom nav di HP. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <Sidebar />

      <div className="sticky top-0 z-10 flex items-center bg-bg/85 px-gutter py-3 backdrop-blur-lg lg:hidden">
        <BrandMark />
      </div>

      <main className="mx-auto max-w-6xl px-gutter pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom)+1.5rem)] lg:ml-sidebar lg:mr-0 lg:px-10 lg:pb-12">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
