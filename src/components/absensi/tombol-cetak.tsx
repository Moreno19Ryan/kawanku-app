"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function TombolCetak() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("utama")}>
      <Printer className="size-4" aria-hidden />
      Cetak
    </button>
  );
}
