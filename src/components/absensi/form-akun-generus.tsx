"use client";

import { useId } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

const KECIL = `${INPUT_CLASS} h-10 py-0 text-sm`;

function IsianPin({ adaTanggal, wajib }: { adaTanggal: boolean; wajib?: boolean }) {
  return (
    <input
      name="pin"
      inputMode="numeric"
      pattern="\d{6}"
      maxLength={6}
      required={wajib && !adaTanggal}
      autoComplete="off"
      placeholder={adaTanggal ? "PIN (kosong = tgl lahir DDMMYY)" : "PIN 6 angka (wajib)"}
      aria-label="PIN awal"
      className={`${KECIL} w-full sm:w-64`}
    />
  );
}

/** Buat akun: username (usulan dari nama panggilan / nama lengkap) + PIN awal. */
export function FormBuatAkun({ aksi, usulan, adaTanggal }: { aksi: Aksi; usulan: string[]; adaTanggal: boolean }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const daftar = useId();
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        name="username"
        required
        list={daftar}
        defaultValue={usulan[0]}
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Username"
        className={`${KECIL} w-full sm:w-48`}
      />
      <datalist id={daftar}>
        {usulan.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <IsianPin adaTanggal={adaTanggal} wajib />
      <button type="submit" disabled={pending} className={buttonClass("utama", "h-10 px-4")}>
        {pending ? "Membuat…" : "Buat akun"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

export function FormUsername({ aksi, username }: { aksi: Aksi; username: string }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="username"
        required
        defaultValue={username}
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Username"
        className={`${KECIL} w-full sm:w-48`}
      />
      <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 px-4")}>
        Ubah username
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

export function FormAturUlangPin({ aksi, adaTanggal }: { aksi: Aksi; adaTanggal: boolean }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <IsianPin adaTanggal={adaTanggal} wajib />
      <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 px-4")}>
        Atur ulang PIN
      </button>
      <PesanAksi state={state} />
    </form>
  );
}
