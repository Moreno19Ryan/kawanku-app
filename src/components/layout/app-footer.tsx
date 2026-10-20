import { LogoDesa } from "@/components/brand/logo-desa";

/** Footer semua halaman: identitas Desa Kartika Wanasari. */
export function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex flex-col items-center gap-3 border-t border-border pt-6 text-center text-xs text-muted sm:flex-row sm:justify-between sm:text-left ${className}`}
    >
      <LogoDesa variant="horizontal" height={32} />
      <p>KawanKu · Aplikasi Desa Kartika Wanasari</p>
    </footer>
  );
}
