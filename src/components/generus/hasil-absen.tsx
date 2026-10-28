"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { bunyi } from "@/lib/absensi/bunyi";
import { absen, type HasilAbsen } from "@/lib/generus/actions";
import { ucapanSyukur } from "@/lib/label";
import { hariTanggal, jamDetik } from "@/lib/waktu";

const PESAN: Record<HasilAbsen["hasil"], string> = {
  tercatat: "Sudah tercatat hadir",
  sudah: "Alhamdulillah, sudah tercatat hadir sebelumnya",
  kedaluwarsa: "QR sudah kedaluwarsa. Scan ulang QR yang sedang tampil di layar.",
  qr_tidak_sah: "QR tidak dikenal. Pastikan scan QR di layar admin.",
  sesi_ditutup: "Sesi absensi ini sudah ditutup.",
  belum_waktunya: "Absensi pertemuan ini belum dibuka. Coba lagi menjelang pertemuan dimulai.",
  lewat_waktu: "Absensi sudah lewat waktunya. Bila kamu hadir, sampaikan ke admin supaya dicatat.",
  bukan_peserta: "Kamu bukan peserta sesi ini.",
  jamaah_nonaktif: "Akunmu tidak aktif. Hubungi admin.",
  bukan_generus: "Akunmu tidak aktif. Hubungi admin.",
  galat: "Mohon maaf, koneksi sedang terputus. Silakan periksa internet, lalu scan ulang.",
};

/** Mencatat absen sekali saat halaman dibuka, lalu menampilkan hasilnya. */
export function HasilAbsen({ token }: { token: string }) {
  const [hasil, setHasil] = useState<HasilAbsen>();
  const sudahKirim = useRef(false);

  useEffect(() => {
    if (sudahKirim.current) return;
    sudahKirim.current = true;
    absen(token)
      .catch((): HasilAbsen => ({ hasil: "galat" }))
      .then((h) => {
        setHasil(h);
        bunyi(h.hasil === "tercatat" ? "berhasil" : h.hasil === "sudah" ? "sudah" : "gagal");
      });
  }, [token]);

  if (!hasil) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-12 text-center text-muted">
        <LoaderCircle className="size-10 animate-spin" aria-hidden />
        <p>Mencatat kehadiran…</p>
      </div>
    );
  }

  const nada =
    hasil.hasil === "tercatat"
      ? "bg-success/10 text-success"
      : hasil.hasil === "sudah"
        ? "bg-primary-soft text-primary"
        : "bg-danger/10 text-danger";
  const ok = hasil.hasil === "tercatat" || hasil.hasil === "sudah";

  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="assertive" className={`flex flex-col items-center gap-3 rounded-card px-6 py-10 text-center ${nada}`}>
        {ok ? <CircleCheck className="size-14" aria-hidden /> : <CircleAlert className="size-14" aria-hidden />}
        <p className="text-xl font-semibold">
          {hasil.hasil === "tercatat" ? `${ucapanSyukur(hasil.jenisKelamin)}, sudah tercatat hadir` : PESAN[hasil.hasil]}
        </p>
        {ok && hasil.dicatat_at ? (
          // Jam dari catatan absensi di database (bukan jam perangkat), sama dengan rekap admin.
          <>
            <p className="mt-1 text-sm">Tercatat pukul</p>
            <p className="text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums">
              {jamDetik(hasil.dicatat_at)} <span className="text-lg">WIB</span>
            </p>
            <p className="text-sm">
              {[hariTanggal(hasil.dicatat_at), hasil.sesi].filter(Boolean).join(" · ")}
            </p>
          </>
        ) : (
          hasil.sesi && <p className="text-sm">{hasil.sesi}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {!ok && (
          <Link href="/saya/scan" className={buttonClass("utama")}>
            Scan ulang
          </Link>
        )}
        <Link href="/saya" className={buttonClass(ok ? "utama" : "netral")}>
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
