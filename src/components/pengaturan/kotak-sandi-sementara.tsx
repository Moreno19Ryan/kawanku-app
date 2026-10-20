"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/**
 * Kata sandi sementara, ditampilkan sekali saja (tidak disimpan di mana pun).
 * Admin pembuat menyampaikannya langsung ke pemilik akun.
 */
export function KotakSandiSementara({ email, sandi }: { email?: string; sandi: string }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(sandi);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard bisa diblokir browser; teks tetap bisa diseleksi manual.
    }
  }

  return (
    <div role="status" className="rounded-control border border-success/30 bg-success/10 p-4">
      {email && <p className="text-sm">Akun <span className="font-semibold">{email}</span></p>}
      <p className="mt-1 text-sm text-muted">Kata sandi sementara:</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-control bg-surface px-3 py-2 font-mono text-lg tracking-wider select-all">
          {sandi}
        </code>
        <button type="button" onClick={salin} className={buttonClass("netral", "h-10")}>
          {tersalin ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {tersalin ? "Tersalin" : "Salin"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Hanya ditampilkan sekali. Sampaikan langsung ke pemiliknya (jangan di grup), lalu minta ia
        menggantinya di Pengaturan → Akun saya setelah login.
      </p>
    </div>
  );
}
