"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

const KECIL = `${INPUT_CLASS} h-10 py-0 text-sm`;

/** Catat hasil menyapa jamaah yang lama tidak hadir. */
export function FormSapaan({ aksi }: { aksi: Aksi }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select name="hasil" defaultValue="tersambung" aria-label="Hasil sapaan" className={`${KECIL} w-full sm:w-48`}>
          <option value="tersambung">Sudah disapa</option>
          <option value="berhalangan">Sedang berhalangan</option>
          <option value="belum_tersambung">Belum tersambung</option>
        </select>
        <input
          name="catatan"
          maxLength={300}
          placeholder="Catatan singkat (opsional), mis. sedang kerja shift"
          aria-label="Catatan sapaan"
          className={`${KECIL} w-full sm:flex-1`}
        />
        <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 shrink-0 px-4")}>
          {pending ? "Menyimpan…" : "Catat"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
