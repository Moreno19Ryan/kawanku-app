"use client";

import { Suspense, useActionState, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Eye, EyeOff } from "lucide-react";
import { masuk, type StateMasuk } from "@/lib/auth/actions";
import { tujuanAman } from "@/lib/auth/tujuan";
import { INPUT_CLASS } from "@/components/ui/input";

const PESAN_PARAM: Record<string, string> = {
  "bukan-admin": "Akun ini belum terdaftar sebagai admin aktif. Silakan hubungi admin desa.",
  "sesi-berakhir": "Sesi sudah berakhir. Silakan masuk kembali.",
};

/**
 * Form login admin. Form-nya sendiri statis (ikut prerender), jadi isian
 * tidak hilang; hanya bagian yang membaca ?next= dan ?galat= yang menunggu
 * di dalam <Suspense>. Kata sandi bisa ditampilkan (ikon mata), dan ada
 * peringatan bila Caps Lock menyala.
 */
export function FormMasuk() {
  const [state, action, pending] = useActionState<StateMasuk, FormData>(masuk, {});
  const [lihat, setLihat] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const cekCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <form action={action} className="mt-5 flex flex-col gap-5">
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="kata-sandi" className="text-sm font-medium">
          Kata sandi
        </label>
        <div className="relative">
          <input
            id="kata-sandi"
            type={lihat ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            onKeyDown={cekCaps}
            onKeyUp={cekCaps}
            onBlur={() => setCapsLock(false)}
            className={`${INPUT_CLASS} w-full pr-14`}
          />
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={lihat}
            className="absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-pill text-muted transition-colors duration-200 ease-oneui hover:bg-border hover:text-fg"
          >
            {lihat ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
        {capsLock && (
          <p className="inline-flex items-center gap-1.5 self-start rounded-pill bg-warning/15 px-3 py-1 text-xs font-medium text-fg">
            <ArrowUp className="size-3.5" aria-hidden />
            Caps Lock menyala
          </p>
        )}
      </div>

      {state.galat ? (
        <Pesan key={state.galat + String(pending)} teks={state.galat} />
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
        className="h-13 rounded-pill bg-primary text-base font-semibold text-primary-fg transition-opacity duration-200 ease-oneui disabled:opacity-50"
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
      className={teks ? "kk-goyang rounded-control bg-danger/10 px-4 py-3 text-sm text-danger" : "sr-only"}
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
