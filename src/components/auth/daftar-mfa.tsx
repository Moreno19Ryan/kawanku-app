"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Copy } from "lucide-react";
import { IsianPin } from "@/components/generus/isian-pin";
import { buttonClass } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Faktor = { id: string; qr: string; rahasia: string };

/**
 * Mendaftarkan aplikasi authenticator (TOTP): tampilkan QR + kode rahasia,
 * lalu minta satu kode untuk memastikan sudah tersimpan. Pendaftaran yang
 * dulu tidak selesai dibersihkan lebih dulu.
 */
export function DaftarMfa({ tujuan }: { tujuan: string }) {
  const [faktor, setFaktor] = useState<Faktor>();
  const [galat, setGalat] = useState<string>();
  const [pending, setPending] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [ulang, setUlang] = useState(0);
  const mulai = useRef(false);

  useEffect(() => {
    if (mulai.current) return;
    mulai.current = true;
    (async () => {
      const supabase = createClient();
      const { data: daftar } = await supabase.auth.mfa.listFactors();
      for (const f of daftar?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const jumlah = (daftar?.totp ?? []).filter((f) => f.status === "verified").length;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Perangkat ${jumlah + 1} (${new Date().toLocaleDateString("id-ID")})`,
        issuer: "KawanKu",
      });
      if (error || !data) {
        setGalat("Mohon maaf, pendaftaran belum bisa dimulai. Silakan muat ulang halaman.");
        return;
      }
      setFaktor({ id: data.id, qr: data.totp.qr_code, rahasia: data.totp.secret });
    })();
  }, []);

  async function kirim(kode: string) {
    if (!faktor || pending) return;
    setPending(true);
    setGalat(undefined);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: faktor.id, code: kode });
    setPending(false);
    if (error) {
      setGalat("Mohon maaf, kode belum cocok. Silakan masukkan kode terbaru yang tampil di aplikasi.");
      setUlang((n) => n + 1);
      return;
    }
    setSelesai(true);
  }

  if (selesai) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CircleCheck className="size-12 text-success" aria-hidden />
        <p className="font-semibold">Alhamdulillah, verifikasi dua langkah sudah aktif.</p>
        <p className="text-sm text-muted">
          Mulai sekarang, setiap masuk akan diminta kode 6 angka dari aplikasi tersebut. Mohon simpan kode rahasia di
          tempat aman sebagai cadangan.
        </p>
        <button type="button" onClick={() => window.location.assign(tujuan)} className={buttonClass("utama", "w-full")}>
          Lanjutkan
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>Pasang aplikasi authenticator di HP, mis. Google Authenticator atau Microsoft Authenticator.</li>
        <li>Di aplikasi itu, pilih tambah akun lalu scan QR di bawah.</li>
        <li>Masukkan kode 6 angka yang muncul di aplikasi.</li>
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-card bg-surface-muted p-4">
        {faktor ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR berupa data URI SVG dari Supabase.
          <img src={faktor.qr} alt="QR untuk aplikasi authenticator" width={184} height={184} className="rounded-control bg-white p-2" />
        ) : (
          <div className="size-[184px] animate-pulse rounded-control bg-border" aria-label="Menyiapkan QR…" />
        )}
        {faktor && (
          <div className="w-full text-center">
            <p className="text-xs text-muted">Tidak bisa scan? Ketik kode rahasia ini di aplikasi:</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(faktor.rahasia);
                  setTersalin(true);
                } catch {}
              }}
              className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 font-mono text-xs break-all"
            >
              <Copy className="size-3.5 shrink-0" aria-hidden />
              {tersalin ? "Tersalin" : faktor.rahasia}
            </button>
          </div>
        )}
      </div>

      <div key={ulang} className={ulang > 0 ? "kk-goyang" : ""}>
        <IsianPin
          name="kode"
          label="Angka kode"
          tersembunyi={false}
          galat={Boolean(galat)}
          onUbah={() => galat && setGalat(undefined)}
          onLengkap={(kode) => void kirim(kode)}
        />
      </div>
      <p role="status" aria-live="polite" className={galat ? "rounded-control bg-danger/10 px-4 py-3 text-sm text-danger" : "text-sm text-muted"}>
        {galat ?? (pending ? "Memeriksa…" : "Otomatis diperiksa begitu angka terakhir diisi.")}
      </p>
    </div>
  );
}
