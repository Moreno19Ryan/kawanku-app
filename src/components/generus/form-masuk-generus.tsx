"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui/input";
import { siapkanMasukGenerus } from "@/lib/generus/masuk-actions";
import { tujuanGenerus } from "@/lib/generus/tujuan";
import { createClient } from "@/lib/supabase/client";

const PESAN_PARAM: Record<string, string> = {
  "bukan-generus": "Akun ini tidak aktif sebagai akun generus. Hubungi admin.",
  "sesi-berakhir": "Sesimu sudah berakhir. Silakan masuk lagi.",
};

/**
 * Login generus (username + PIN). PIN diperiksa server (kunci 5x salah →
 * 15 menit); bila benar, server memberi kata sandi sekali pakai dan browser
 * login sendiri, supaya batas percobaan Supabase dihitung per perangkat.
 */
export function FormMasukGenerus() {
  const [galat, setGalat] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "").trim().toLowerCase();
    const pin = String(fd.get("pin") ?? "").trim();
    const tujuan = tujuanGenerus(fd.get("tujuan"));
    if (!username || !/^\d{6}$/.test(pin)) {
      setGalat("Isi username dan PIN 6 angka.");
      return;
    }

    setPending(true);
    setGalat(undefined);
    const supabase = createClient();
    try {
      const izin = await siapkanMasukGenerus(username, pin);
      if ("galat" in izin) return setGalat(izin.galat);
      const { error } = await supabase.auth.signInWithPassword({ email: izin.email, password: izin.password });
      if (error) {
        return setGalat(
          error.status === 429 ? "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." : "Gagal masuk. Coba lagi.",
        );
      }
      // Muat ulang penuh supaya server membaca cookie sesi yang baru.
      window.location.assign(izin.pinAwal ? `/saya/pin?next=${encodeURIComponent(tujuan)}` : tujuan);
    } catch {
      setGalat("Gagal terhubung. Periksa internet lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Username</span>
        <input
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="mis. abdulazizsyahputra"
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">PIN</span>
        <input
          name="pin"
          type="password"
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="current-password"
          placeholder="6 angka"
          className={`${INPUT_CLASS} tracking-[0.4em]`}
        />
      </label>

      {galat ? (
        <Pesan teks={galat} />
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

function PesanParam() {
  const galat = useSearchParams().get("galat");
  return <Pesan teks={galat ? PESAN_PARAM[galat] : undefined} />;
}

function TujuanParam() {
  return <input type="hidden" name="tujuan" value={useSearchParams().get("next") ?? ""} />;
}
