"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { KotakSandiSementara } from "./kotak-sandi-sementara";
import { PesanAksi } from "./pesan-aksi";

/** Atur ulang kata sandi admin lain; hasilnya kata sandi sementara baru. */
export function TombolAturUlangSandi({
  aksi,
  nama,
}: {
  aksi: () => Promise<StateAksi>;
  nama: string;
}) {
  const [state, action, pending] = useActionState<StateAksi>(aksi, {});

  return (
    <div className="flex flex-col gap-3">
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(`Buat kata sandi sementara baru untuk ${nama}? Kata sandi lamanya tidak berlaku lagi.`)) {
            e.preventDefault();
          }
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <button type="submit" disabled={pending} className={buttonClass("netral", "h-9 px-4")}>
          {pending ? "Memproses…" : "Atur ulang kata sandi"}
        </button>
        {state.galat && <PesanAksi state={state} />}
      </form>
      {state.sandiSementara && <KotakSandiSementara sandi={state.sandiSementara} />}
    </div>
  );
}
