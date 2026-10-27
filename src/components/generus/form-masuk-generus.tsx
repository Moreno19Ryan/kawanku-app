"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui/input";
import { Saklar } from "@/components/ui/saklar";
import { usePerangkat } from "@/components/perangkat/use-perangkat";
import { namaPerangkat } from "@/lib/perangkat";
import { siapkanMasukGenerus } from "@/lib/generus/masuk-actions";
import { tujuanGenerus } from "@/lib/generus/tujuan";
import { createClient } from "@/lib/supabase/client";
import { IsianPin } from "./isian-pin";

const PESAN_PARAM: Record<string, string> = {
  "bukan-generus": "Mohon maaf, akun ini belum aktif sebagai akun generus. Silakan hubungi admin kelompok.",
  "sesi-berakhir": "Sesi sudah berakhir. Silakan masuk kembali.",
};

/** Username yang diingat di perangkat ini (localStorage; hanya username, tidak pernah PIN). */
const KUNCI_INGAT = "kk-generus-username";
const PERISTIWA = "kk-ingat-username";

function bacaIngat(): string | null {
  try {
    return localStorage.getItem(KUNCI_INGAT);
  } catch {
    return null;
  }
}

function tulisIngat(username: string | null) {
  try {
    if (username) localStorage.setItem(KUNCI_INGAT, username);
    else localStorage.removeItem(KUNCI_INGAT);
  } catch {
    // Penyimpanan diblokir (mode privat): abaikan.
  }
  window.dispatchEvent(new Event(PERISTIWA));
}

function langganan(berubah: () => void) {
  window.addEventListener(PERISTIWA, berubah);
  window.addEventListener("storage", berubah);
  return () => {
    window.removeEventListener(PERISTIWA, berubah);
    window.removeEventListener("storage", berubah);
  };
}

/**
 * Login generus (username + PIN 6 kotak). PIN diperiksa server (kunci 5x
 * salah → 15 menit); bila benar, server memberi kata sandi sekali pakai dan
 * browser login sendiri, supaya batas percobaan Supabase dihitung per
 * perangkat. Username boleh diingat di perangkat ini ("Masuk sebagai …?").
 */
export function FormMasukGenerus() {
  const diingat = useSyncExternalStore(langganan, bacaIngat, () => null);
  const perangkat = usePerangkat();
  const labelIngat = `Ingat username di ${namaPerangkat(perangkat)} ini`;
  const [galat, setGalat] = useState<string>();
  const [pending, setPending] = useState(false);
  // Naik setiap kali PIN belum cocok: mengosongkan kotak PIN & memicu getar.
  const [ulang, setUlang] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const isianUsername = useRef<HTMLInputElement>(null);

  // Laptop: username langsung siap diketik. HP/tablet: jangan memunculkan
  // papan ketik yang menutupi layar sebelum diketuk.
  useEffect(() => {
    if (perangkat === "laptop" && !diingat) isianUsername.current?.focus();
  }, [perangkat, diingat]);

  function gagal(pesan: string) {
    setGalat(pesan);
    setUlang((n) => n + 1);
  }

  async function kirim(pinLangsung?: string) {
    if (!form.current || pending) return;
    const fd = new FormData(form.current);
    const username = String(diingat ?? fd.get("username") ?? "").trim().toLowerCase();
    const pin = (pinLangsung ?? String(fd.get("pin") ?? "")).trim();
    const ingat = diingat ? true : fd.get("ingat") === "on";
    const tujuan = tujuanGenerus(fd.get("tujuan"));
    if (!username) return gagal("Mohon isi username terlebih dahulu.");
    if (!/^\d{6}$/.test(pin)) return gagal("Mohon isi PIN 6 angka.");

    setPending(true);
    setGalat(undefined);
    try {
      const supabase = createClient();
      const izin = await siapkanMasukGenerus(username, pin);
      if ("galat" in izin) return gagal(izin.galat);
      const { error } = await supabase.auth.signInWithPassword({ email: izin.email, password: izin.password });
      if (error) {
        return gagal(
          error.status === 429
            ? "Mohon maaf, terlalu banyak percobaan. Silakan tunggu beberapa menit, lalu coba lagi."
            : "Mohon maaf, belum berhasil masuk. Silakan dicoba lagi.",
        );
      }
      tulisIngat(ingat ? username : null);
      // Muat ulang penuh supaya server membaca cookie sesi yang baru.
      window.location.assign(izin.pinAwal ? `/saya/pin?next=${encodeURIComponent(tujuan)}` : tujuan);
    } catch {
      gagal("Mohon maaf, koneksi sedang terputus. Silakan periksa internet, lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void kirim();
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="mt-5 flex flex-col gap-5">
      {diingat ? (
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span aria-hidden className="flex size-16 items-center justify-center rounded-pill bg-primary-soft text-2xl font-semibold text-primary uppercase">
            {diingat.slice(0, 1)}
          </span>
          <p className="text-lg font-semibold">
            Masuk sebagai <span className="text-primary">{diingat}</span>?
          </p>
          <button
            type="button"
            onClick={() => tulisIngat(null)}
            className="rounded-pill bg-surface-muted px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-oneui hover:bg-border"
          >
            Bukan saya, ganti akun
          </button>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Username</span>
          <input
            name="username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            ref={isianUsername}
            placeholder="mis. abdulazizsyahputra"
            className={INPUT_CLASS}
          />
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 text-sm font-medium ${diingat ? "mx-auto" : ""}`}>{diingat ? "Ketik PIN-mu" : "PIN"}</legend>
        <div key={ulang} className={ulang > 0 ? "kk-goyang" : ""}>
          <IsianPin
            key={ulang}
            galat={Boolean(galat)}
            autoFocus={Boolean(diingat)}
            onUbah={() => galat && setGalat(undefined)}
            onLengkap={(pin) => void kirim(pin)}
          />
        </div>
        {!diingat && <p className="text-xs text-muted">6 angka. Otomatis masuk begitu angka terakhir diisi.</p>}
      </fieldset>

      {!diingat && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">
            <span className="block font-medium">{labelIngat}</span>
            <span className="block text-xs text-muted">Lain kali cukup ketik PIN.</span>
          </span>
          <Saklar name="ingat" label={labelIngat} defaultChecked />
        </div>
      )}

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
