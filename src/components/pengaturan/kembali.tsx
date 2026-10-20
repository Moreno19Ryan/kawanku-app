import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Tautan kembali ke halaman utama Pengaturan. */
export function KembaliKePengaturan() {
  return (
    <Link
      href="/pengaturan"
      className="-ml-2 mt-6 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft lg:mt-8"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Pengaturan
    </Link>
  );
}
