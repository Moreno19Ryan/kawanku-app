"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Maximize } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { hadirLayar, tokenLayar } from "@/lib/absensi/actions";
import { createClient } from "@/lib/supabase/client";
import { langganan } from "@/lib/supabase/realtime";

const GANTI_DETIK = 60;

/**
 * QR absen jalur 2 untuk ditampilkan di layar/proyektor. Berganti tiap 60
 * detik (token berlaku 90 detik, jadi yang sedang scan saat pergantian
 * tetap tercatat). Isi QR = URL /absen?t=... (bisa dibuka kamera HP).
 */
export function LayarQr({
  sesiId,
  ambil,
  hitung,
}: {
  sesiId: string;
  ambil: () => ReturnType<typeof tokenLayar>;
  hitung: () => ReturnType<typeof hadirLayar>;
}) {
  const [svg, setSvg] = useState<string>();
  const [status, setStatus] = useState<"memuat" | "ok" | "ditutup" | "galat">("memuat");
  const [hadir, setHadir] = useState(0);
  const [sisa, setSisa] = useState(GANTI_DETIK);

  useEffect(() => {
    let batal = false;
    let detik = 0;

    async function muat() {
      try {
        const r = await ambil();
        if (batal) return;
        if (!r) return setStatus("galat");
        setHadir(r.hadir);
        if (!r.token) return setStatus("ditutup");
        const url = `${window.location.origin}/absen?t=${encodeURIComponent(r.token)}`;
        setSvg(await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }));
        setStatus("ok");
      } catch {
        if (!batal) setStatus("galat");
      }
    }

    void muat();
    const timer = setInterval(() => {
      detik += 1;
      setSisa(GANTI_DETIK - (detik % GANTI_DETIK));
      if (detik % GANTI_DETIK === 0) void muat();
    }, 1000);
    return () => {
      batal = true;
      clearInterval(timer);
    };
  }, [ambil]);

  // Angka hadir naik langsung setiap ada yang scan (Supabase Realtime pada
  // absensi sesi ini; tetap RLS). Perubahan beruntun digabung sekali hitung.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const perbarui = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const n = await hitung().catch(() => null);
        if (n !== null) setHadir(n);
      }, 250);
    };
    const berhenti = langganan(supabase, `layar-${sesiId}`, (kanal) =>
      kanal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "absensi", filter: `sesi_id=eq.${sesiId}` },
        perbarui,
      ),
    );
    return () => {
      clearTimeout(timer);
      berhenti();
    };
  }, [sesiId, hitung]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex aspect-square w-[min(80vw,62vh)] items-center justify-center rounded-card bg-paper p-4 text-paper-fg">
        {status === "ok" && svg ? (
          // SVG dibuat di browser dari token server (bukan input pengguna).
          <span className="block size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className="px-6 text-center text-lg">
            {status === "memuat"
              ? "Menyiapkan QR…"
              : status === "ditutup"
                ? "Absensi belum terbuka atau sudah tertutup. QR muncul sendiri saat absensi terbuka."
                : "Mohon maaf, QR belum berhasil dimuat. Silakan periksa internet; akan dicoba lagi otomatis."}
          </p>
        )}
      </div>
      <p className="text-center text-lg">
        Buka <span className="font-semibold">KawanKu</span> di HP → <span className="font-semibold">Scan QR absen</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted">
        <span>QR berganti dalam {sisa} detik</span>
        <span className="font-semibold text-success" aria-live="polite">
          {/* key: animasi "naik" setiap angka berubah */}
          <span key={hadir} className="kk-angka-naik inline-block tabular-nums">
            {hadir}
          </span>{" "}
          hadir
        </span>
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          className={buttonClass("netral", "h-9 px-4")}
        >
          <Maximize className="size-4" aria-hidden />
          Layar penuh
        </button>
      </div>
    </div>
  );
}
