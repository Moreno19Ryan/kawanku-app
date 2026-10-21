import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KeyRound, ScanLine, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DaftarKejadian } from "@/components/kegiatan/daftar-kejadian";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { LABEL_ALASAN_IZIN } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Absen Saya",
};

type Riwayat = {
  status: "hadir" | "izin" | "sakit";
  alasan_izin: string | null;
  dicatat_at: string;
  sesi: { nama: string; mulai: string } | null;
};

export default function SayaPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
      <BerandaGenerus />
    </Suspense>
  );
}

async function BerandaGenerus() {
  const generus = await wajibGenerus();
  const supabase = await createClient();
  const { data } = await supabase
    .from("absensi")
    .select("status, alasan_izin, dicatat_at, sesi:sesi_id(nama, mulai)")
    .eq("jamaah_id", generus.jamaah.id)
    .order("dicatat_at", { ascending: false })
    .limit(30)
    .returns<Riwayat[]>();
  const riwayat = data ?? [];
  const hariIni = hariIniWib();
  const jadwal = await getKalender(hariIni, tambahHari(hariIni, 6), [generus.jamaah.kelompokId]);
  const hadir = riwayat.filter((r) => r.status === "hadir").length;

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div>
        <p className="text-sm text-muted">Assalamu&apos;alaikum,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{generus.jamaah.panggilan ?? generus.jamaah.nama}</h1>
        <p className="text-sm text-muted">
          {[generus.jamaah.kelompok, `@${generus.username}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Link href="/saya/scan" className={buttonClass("utama", "h-16 text-base")}>
        <ScanLine className="size-6" aria-hidden />
        Scan QR absen
      </Link>
      <p className="-mt-2 text-center text-xs text-muted">
        Arahkan kamera ke QR di layar admin. Bisa juga pakai aplikasi kamera HP.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted">Jadwal 7 hari ke depan</h2>
        <DaftarKejadian
          kejadian={jadwal}
          namaKelompok={new Map([[generus.jamaah.kelompokId, generus.jamaah.kelompok ?? "Kelompok"]])}
          tautan={false}
          kosong="Belum ada jadwal kegiatan pekan ini."
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted">
          Riwayat kehadiran · {hadir} hadir dari {riwayat.length} catatan terakhir
        </h2>
        {riwayat.length === 0 ? (
          <Card className="text-center text-sm text-muted">Belum ada catatan kehadiran.</Card>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {riwayat.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.sesi?.nama ?? "Sesi"}</span>
                  <span className="block text-sm text-muted">{tanggalJam(r.sesi?.mulai ?? r.dicatat_at)}</span>
                </span>
                <Badge nada={r.status === "hadir" ? "sukses" : "netral"}>
                  {r.status === "hadir"
                    ? "Hadir"
                    : r.status === "sakit"
                      ? "Sakit"
                      : `Izin (${LABEL_ALASAN_IZIN[r.alasan_izin ?? ""]?.toLowerCase() ?? "-"})`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/saya/profil" className={buttonClass("netral")}>
          <UserRound className="size-4" aria-hidden />
          Profil saya
        </Link>
        <Link href="/saya/pin" className={buttonClass("netral")}>
          <KeyRound className="size-4" aria-hidden />
          Ganti PIN
        </Link>
      </div>
    </div>
  );
}
