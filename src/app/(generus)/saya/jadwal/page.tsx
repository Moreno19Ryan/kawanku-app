import type { Metadata } from "next";
import { Suspense } from "react";
import { TautanIzin } from "@/components/generus/tautan-izin";
import { DaftarKejadian } from "@/components/kegiatan/daftar-kejadian";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { Memuat } from "@/components/ui/memuat";
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
  const kejadian = await getKalender(hariIni, tambahHari(hariIni, 29), [generus.jamaah.kelompokId]);
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jadwal</h1>
        <p className="text-sm text-muted">
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
  );
}
