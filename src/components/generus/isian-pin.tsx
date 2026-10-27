"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

const PANJANG = 6;

/**
 * PIN 6 kotak (gaya kode OTP): keyboard angka, kursor pindah otomatis,
 * Backspace mundur, tempel 6 angka sekaligus. Nilai dikirim lewat input
 * tersembunyi `name`. `onLengkap(pin)` dipanggil begitu angka ke-6 terisi.
 * Ganti `key` dari induk untuk mengosongkan (mis. setelah PIN belum cocok).
 */
export function IsianPin({
  name = "pin",
  onLengkap,
  onUbah,
  autoFocus = false,
  galat = false,
}: {
  name?: string;
  onLengkap?: (pin: string) => void;
  /** Dipanggil setiap kali isian berubah (mis. menghapus tanda galat). */
  onUbah?: () => void;
  autoFocus?: boolean;
  galat?: boolean;
}) {
  const [angka, setAngka] = useState<string[]>(() => Array(PANJANG).fill(""));
  const kotak = useRef<(HTMLInputElement | null)[]>([]);

  // autoFocus juga saat prop berubah setelah tampil (mis. username diingat
  // baru terbaca setelah hidrasi).
  useEffect(() => {
    if (autoFocus) kotak.current[0]?.focus();
  }, [autoFocus]);

  function isi(mulai: number, teks: string) {
    const masuk = teks.replace(/\D/g, "").slice(0, PANJANG - mulai).split("");
    if (masuk.length === 0) return;
    const baru = [...angka];
    masuk.forEach((a, i) => (baru[mulai + i] = a));
    setAngka(baru);
    onUbah?.();
    const berikut = Math.min(mulai + masuk.length, PANJANG - 1);
    kotak.current[berikut]?.focus();
    if (baru.every(Boolean)) onLengkap?.(baru.join(""));
  }

  function tombol(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !angka[i] && i > 0) {
      e.preventDefault();
      const baru = [...angka];
      baru[i - 1] = "";
      setAngka(baru);
      kotak.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      kotak.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < PANJANG - 1) {
      kotak.current[i + 1]?.focus();
    }
  }

  function tempel(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    isi(i, e.clipboardData.getData("text"));
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
      <input type="hidden" name={name} value={angka.join("")} />
      {angka.map((a, i) => (
        <input
          key={i}
          ref={(el) => {
            kotak.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label={`Angka PIN ke-${i + 1}`}
          aria-invalid={galat || undefined}
          value={a}
          maxLength={PANJANG}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v === "") {
              const baru = [...angka];
              baru[i] = "";
              setAngka(baru);
              onUbah?.();
            } else {
              // Ambil angka yang baru diketik (atau semua bila isian otomatis/tempel).
              isi(i, v.length > 1 && a ? v.slice(-1) : v);
            }
          }}
          onKeyDown={(e) => tombol(i, e)}
          onPaste={(e) => tempel(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-14 min-w-0 rounded-control border text-center text-2xl outline-none transition-colors duration-200 ease-oneui focus:border-2 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-soft ${
            galat ? "border-2 border-danger bg-surface" : a ? "border-border bg-surface" : "border-border bg-surface-muted"
          }`}
        />
      ))}
    </div>
  );
}
