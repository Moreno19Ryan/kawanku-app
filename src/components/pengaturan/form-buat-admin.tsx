"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { buatAdmin, type StateAksi } from "@/lib/pengaturan/actions";
import { KotakSandiSementara } from "./kotak-sandi-sementara";
import { PesanAksi } from "./pesan-aksi";
import { PilihPeranWilayah, type OpsiKelompok, type OpsiPeran } from "./pilih-peran-wilayah";

/** Membuat akun admin baru: email, nama, peran + wilayah. */
export function FormBuatAdmin({ peran, kelompok }: { peran: OpsiPeran[]; kelompok: OpsiKelompok[] }) {
  const [state, action, pending] = useActionState<StateAksi, FormData>(buatAdmin, {});

  return (
    <div className="flex flex-col gap-4">
      {/* key: kosongkan form setelah berhasil. */}
      <form key={state.sandiSementara} action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              placeholder="adminkelompok5@kawanku.com"
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Nama</span>
            <input
              name="nama"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="Nama yang tampil di aplikasi"
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Peran</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PilihPeranWilayah peran={peran} kelompok={kelompok} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass("utama")}>
            {pending ? "Membuat akun…" : "Buat akun admin"}
          </button>
          {state.galat && <PesanAksi state={state} />}
        </div>
      </form>

      {state.sandiSementara && (
        <KotakSandiSementara email={state.email} sandi={state.sandiSementara} />
      )}
    </div>
  );
}
