"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";

export function FormNamaKelompok({
  aksi,
  nama,
  nomor,
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  nama: string;
  nomor: number;
}) {
  const [state, action, pending] = useActionState(aksi, {});

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          name="nama"
          required
          maxLength={60}
          defaultValue={nama}
          aria-label={`Nama kelompok ${nomor}`}
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
