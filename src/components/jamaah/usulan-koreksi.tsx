"use client";

import { useActionState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

/** Tanggapan admin untuk laporan data salah: sudah dibetulkan / tolak. */
export function TanganiUsulan({ aksi }: { aksi: Aksi }) {
  const [state, action, pending] = useActionState(aksi, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input
        name="tanggapan"
        maxLength={300}
        placeholder="Tanggapan untuk jamaah (opsional)"
        aria-label="Tanggapan"
        className={`${INPUT_CLASS} h-9 flex-1 text-sm`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="status" value="selesai" disabled={pending} className={buttonClass("kedua", "h-9 px-4")}>
          Sudah dibetulkan
        </button>
        <button type="submit" name="status" value="ditolak" disabled={pending} className={buttonClass("netral", "h-9 px-4")}>
          Tolak
        </button>
      </div>
      {state.galat && <PesanAksi state={state} />}
    </form>
  );
}
