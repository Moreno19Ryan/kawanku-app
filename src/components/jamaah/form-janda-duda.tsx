"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

/** Keterangan janda/duda: cerai hidup / cerai mati / belum diketahui. */
export function FormJandaDuda({
  aksi,
  jenis,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  jenis: string | null;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select name="jenis" defaultValue={jenis ?? ""} aria-label="Keterangan" className={`${INPUT_CLASS} w-full sm:w-56`}>
        <option value="">Belum diketahui</option>
        <option value="cerai_hidup">Cerai hidup</option>
        <option value="cerai_mati">Cerai mati</option>
      </select>
      <button type="submit" disabled={pending} className={buttonClass("kedua", "h-12")}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}
