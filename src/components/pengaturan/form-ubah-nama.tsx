"use client";

import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";
import { useFormAksi } from "./use-form-aksi";

/** Satu input nama + tombol Simpan (nama kelompok, nama admin). */
export function FormUbahNama({
  aksi,
  nama,
  label,
  maxLength = 60,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  nama: string;
  label: string;
  maxLength?: number;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          name="nama"
          required
          maxLength={maxLength}
          defaultValue={nama}
          aria-label={label}
          className={`${INPUT_CLASS} h-10 min-w-0 flex-1 text-sm`}
        />
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
