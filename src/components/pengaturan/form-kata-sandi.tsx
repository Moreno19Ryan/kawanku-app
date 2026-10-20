"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { gantiKataSandi, type StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";

export function FormKataSandi() {
  const [state, action, pending] = useActionState<StateAksi, FormData>(gantiKataSandi, {});

  return (
    // key: kosongkan isian setelah berhasil.
    <form key={state.pesan} action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Kata sandi lama</span>
        <input
          type="password"
          name="sandi_lama"
          required
          autoComplete="current-password"
          className={INPUT_CLASS}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Kata sandi baru</span>
          <input
            type="password"
            name="sandi_baru"
            required
            minLength={8}
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ulangi kata sandi baru</span>
          <input
            type="password"
            name="sandi_ulang"
            required
            minLength={8}
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <p className="text-xs text-muted">Minimal 8 karakter.</p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Ganti kata sandi"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
