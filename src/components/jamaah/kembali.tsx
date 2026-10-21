import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Tautan kembali ke daftar jamaah. */
export function KembaliKeJamaah() {
  return (
    <Link
      href="/jamaah"
      className="-ml-2 mt-6 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft lg:mt-8"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Jamaah
    </Link>
  );
}
