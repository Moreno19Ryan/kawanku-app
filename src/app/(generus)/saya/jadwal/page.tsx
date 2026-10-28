import type { Metadata } from "next";
import { Suspense } from "react";
import { TautanIzin } from "@/components/generus/tautan-izin";
import { DaftarKejadian } from "@/components/kegiatan/daftar-kejadian";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { SaklarNotifikasi } from "@/components/generus/saklar-notifikasi";
import { Card } from "@/components/ui/card";
import { Memuat } from "@/components/ui/memuat";
import { createClient } from "@/lib/supabase/server";
import { KataTekan } from "@/components/perangkat/kata-tekan";

export const metadata: Metadata = {
  title: "Jadwal",
};

export default function JadwalPage() {
  return (
    <Suspense fallback={<Memuat className="mt-8 h-96" />}>
      <Jadwal />
    </Suspense>
  );
}

async function Jadwal() {
  const generus = await wajibGenerus();
  const hariIni = hariIniWib();
  const supabase = await createClient();
  const [kejadian, { count: izinDiajukan }] = await Promise.all([
    getKalender(hariIni, tambahHari(hariIni, 29), [generus.jamaah.kelompokId]),
    supabase
      .from("pengajuan_izin")
      .select("id", { count: "exact", head: true })
      .eq("jamaah_id", generus.jamaah.id)
      .gte("tanggal", hariIni),
  ]);
  const terjadwal = kejadian.filter((k) => k.status === "terjadwal");
  return (
    <div className="flex flex-col gap-4 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-6 lg:pt-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-[1.75rem]">Jadwal</h1>
          <p className="text-sm text-muted lg:text-base">
            30 hari ke depan, lengkap dengan pemateri & materi bila sudah diumumkan. Berhalangan? <KataTekan /> “Izin”.
          </p>
        </div>
        <DaftarKejadian
          kejadian={kejadian}
          namaKelompok={new Map([[generus.jamaah.kelompokId, generus.jamaah.kelompok ?? "Kelompok"]])}
          tautan={false}
          kosong="Belum ada jadwal kegiatan."
          aksi={(k) => <TautanIzin k={k} />}
        />
      </div>

      {/* Laptop: ringkasan di kolom kanan; HP: di bawah daftar. */}
      <aside className="flex flex-col gap-4 lg:mt-[5.5rem]">
        <Card>
          <h2 className="font-semibold">30 hari ke depan</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Pertemuan</dt>
              <dd className="font-semibold tabular-nums">{terjadwal.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Khusus generus</dt>
              <dd className="font-semibold tabular-nums">{terjadwal.filter((k) => k.kegiatan.hanya_generus).length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Izin diajukan</dt>
              <dd className="font-semibold tabular-nums">{izinDiajukan ?? 0}</dd>
            </div>
          </dl>
        </Card>
        <SaklarNotifikasi ringkas />
      </aside>
    </div>
  );
}
