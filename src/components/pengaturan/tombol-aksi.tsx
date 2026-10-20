"use client";

import { useActionState } from "react";
import { buttonClass, type VarianTombol } from "@/components/ui/button";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

/**
 * Satu tombol = satu Server Action (sudah di-bind dengan id dari server).
 * `konfirmasi` memunculkan dialog konfirmasi bawaan browser dulu.
 */
export function TombolAksi({
  aksi,
  label,
  varian = "netral",
  konfirmasi,
}: {
  aksi: Aksi;
  label: string;
  varian?: VarianTombol;
  konfirmasi?: string;
}) {
  const [state, action, pending] = useActionState(aksi, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (konfirmasi && !window.confirm(konfirmasi)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <button type="submit" disabled={pending} className={buttonClass(varian, "h-9 px-4")}>
        {pending ? "Memproses…" : label}
      </button>
      {state.galat && <PesanAksi state={{ galat: state.galat }} className="max-w-64 text-right" />}
    </form>
  );
}
