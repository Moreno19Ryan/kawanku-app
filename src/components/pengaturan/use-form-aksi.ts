"use client";

import { addTransitionType, startTransition, useActionState, type FormEvent } from "react";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

/**
 * Seperti useActionState, tapi dikirim lewat onSubmit (bukan prop `action`)
 * supaya React tidak mereset isian form otomatis setelah action selesai.
 * Tanpa ini, isian hilang saat validasi server gagal, dan saklar/checkbox
 * kembali ke nilai awal sehingga simpan berikutnya bisa salah.
 */
export function useFormAksi(aksi: Aksi, sebelumKirim?: (form: HTMLFormElement) => boolean) {
  const [state, kirim, pending] = useActionState(aksi, {});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sebelumKirim && !sebelumKirim(e.currentTarget)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => {
      // Simpan form tidak memicu animasi pindah halaman.
      addTransitionType("diam");
      kirim(data);
    });
  }

  return [state, onSubmit, pending] as const;
}
