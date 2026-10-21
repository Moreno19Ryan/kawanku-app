"use client";

import { useActionState, useRef } from "react";
import { INPUT_CLASS } from "@/components/ui/input";
import { LABEL_ALASAN_IZIN } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

/** Nilai select: "" | "hadir" | "sakit" | "izin:<alasan>". Langsung tersimpan saat diganti. */
export function PilihStatus({ aksi, nilai, nama }: { aksi: Aksi; nilai: string; nama: string }) {
  const [state, action, pending] = useActionState(aksi, {});
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="flex flex-col items-end gap-1">
      <select
        name="status"
        // key: kembali ke nilai server setelah refresh (mis. tersimpan dari scan).
        key={nilai}
        defaultValue={nilai}
        disabled={pending}
        aria-label={`Status kehadiran ${nama}`}
        onChange={() => form.current?.requestSubmit()}
        className={`${INPUT_CLASS} h-10 w-40 py-0 text-sm`}
      >
        <option value="">Belum tercatat</option>
        <option value="hadir">Hadir</option>
        {Object.entries(LABEL_ALASAN_IZIN).map(([v, l]) => (
          <option key={v} value={`izin:${v}`}>
            Izin: {l.toLowerCase()}
          </option>
        ))}
        <option value="sakit">Sakit</option>
      </select>
      {state.galat && <p className="max-w-48 text-right text-xs text-danger">{state.galat}</p>}
    </form>
  );
}
