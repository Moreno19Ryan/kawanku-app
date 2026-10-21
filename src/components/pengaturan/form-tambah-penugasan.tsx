"use client";

import { buttonClass } from "@/components/ui/button";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";
import { useFormAksi } from "./use-form-aksi";
import { PilihPeranWilayah, type OpsiKelompok, type OpsiPeran } from "./pilih-peran-wilayah";

/** Tambah peran untuk satu admin: pilih peran, lalu kelompok bila perlu. */
export function FormTambahPenugasan({
  aksi,
  peran,
  kelompok,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  peran: OpsiPeran[];
  kelompok: OpsiKelompok[];
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <PilihPeranWilayah peran={peran} kelompok={kelompok} className="h-10" />
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10")}>
          {pending ? "Menambah…" : "Tambah peran"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
