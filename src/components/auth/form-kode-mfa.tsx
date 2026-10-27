"use client";

import { useState } from "react";
import { IsianPin } from "@/components/generus/isian-pin";
import { createClient } from "@/lib/supabase/client";

/**
 * Isi kode 6 angka dari aplikasi authenticator (aal1 → aal2). Otomatis
 * dikirim begitu angka terakhir diisi; bila belum cocok, kotak dikosongkan.
 */
export function FormKodeMfa({ tujuan }: { tujuan: string }) {
  const [galat, setGalat] = useState<string>();
  const [pending, setPending] = useState(false);
  const [ulang, setUlang] = useState(0);

  async function kirim(kode: string) {
    if (pending) return;
    setPending(true);
    setGalat(undefined);
    try {
      const supabase = createClient();
      const { data: faktor, error: galatFaktor } = await supabase.auth.mfa.listFactors();
      const totp = faktor?.totp.find((f) => f.status === "verified");
      if (galatFaktor || !totp) {
        setGalat("Mohon maaf, perangkat verifikasi belum ditemukan. Silakan keluar lalu masuk kembali.");
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: kode });
      if (error) {
        setGalat(
          error.status === 429
            ? "Mohon maaf, terlalu banyak percobaan. Silakan tunggu sebentar, lalu coba lagi."
            : "Mohon maaf, kode belum cocok. Silakan lihat kode terbaru di aplikasi authenticator.",
        );
        setUlang((n) => n + 1);
        return;
      }
      // Muat ulang penuh supaya server membaca sesi aal2 yang baru.
      window.location.assign(tujuan);
    } catch {
      setGalat("Mohon maaf, koneksi sedang terputus. Silakan periksa internet, lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div key={ulang} className={ulang > 0 ? "kk-goyang" : ""}>
        <IsianPin
          name="kode"
          label="Angka kode"
          tersembunyi={false}
          autoFocus
          galat={Boolean(galat)}
          onUbah={() => galat && setGalat(undefined)}
          onLengkap={(kode) => void kirim(kode)}
        />
      </div>
      <p role="status" aria-live="polite" className={galat ? "rounded-control bg-danger/10 px-4 py-3 text-sm text-danger" : "text-sm text-muted"}>
        {galat ?? (pending ? "Memeriksa…" : "Kode berganti tiap 30 detik. Otomatis diperiksa begitu angka terakhir diisi.")}
      </p>
    </div>
  );
}
