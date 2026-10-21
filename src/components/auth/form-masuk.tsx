"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { masuk, type StateMasuk } from "@/lib/auth/actions";
import { tujuanAman } from "@/lib/auth/tujuan";
import { INPUT_CLASS } from "@/components/ui/input";

const PESAN_PARAM: Record<string, string> = {
  "bukan-admin": "Akun ini bukan admin aktif. Hubungi admin desa.",
  "sesi-berakhir": "Sesimu sudah berakhir. Silakan masuk lagi.",
};

/**
 * Form login admin. Form-nya sendiri statis (ikut prerender), jadi isian
 * tidak hilang; hanya bagian yang membaca ?next= dan ?galat= yang menunggu
 * di dalam <Suspense>.
 */
export function FormMasuk() {
  const [state, action, pending] = useActionState<StateMasuk, FormData>(masuk, {});

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="admin@contoh.id"
          defaultValue={state.email}
          // Ganti key supaya defaultValue dipakai ulang setelah galat.
          key={state.email}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Kata sandi</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={INPUT_CLASS}
        />
      </label>

      {state.galat ? (
        <Pesan teks={state.galat} />
      ) : (
        <Suspense fallback={<Pesan />}>
          <PesanParam />
        </Suspense>
      )}

      <Suspense>
        <TujuanParam />
      </Suspense>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-12 rounded-pill bg-primary font-semibold text-primary-fg transition-opacity duration-200 ease-oneui disabled:opacity-50"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}

function Pesan({ teks }: { teks?: string }) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className={teks ? "rounded-control bg-danger/10 px-4 py-3 text-sm text-danger" : "sr-only"}
    >
      {teks}
    </p>
  );
}

/** Pesan dari ?galat= (mis. dialihkan karena bukan admin aktif). */
function PesanParam() {
  const galat = useSearchParams().get("galat");
  return <Pesan teks={galat ? PESAN_PARAM[galat] : undefined} />;
}

/** Tujuan setelah login, dari ?next= (diperiksa lagi di server). */
function TujuanParam() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="tujuan" value={tujuanAman(next)} /> : null;
}
