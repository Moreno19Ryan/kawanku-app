import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarX, ChevronRight, FileText, MapPin, ScanLine, UserRound } from "lucide-react";
import { KartuKehadiran } from "@/components/generus/kartu-kehadiran";
import { TautanIzin } from "@/components/generus/tautan-izin";
import { DaftarKejadian } from "@/components/kegiatan/daftar-kejadian";
import { DaftarPengumuman } from "@/components/sistem/daftar-pengumuman";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKehadiranSaya } from "@/lib/generus/data";
import { bulanLalu, labelKehadiran, raporBulan, ringkasKehadiran } from "@/lib/generus/kehadiran";
import { sambutan } from "@/lib/generus/sambutan";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { getPengumumanTayang } from "@/lib/sistem/data";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";
import { KartuAsisten } from "@/components/asisten/kartu-asisten";
import { SaklarNotifikasi } from "@/components/generus/saklar-notifikasi";
import { getSaranGenerus } from "@/lib/asisten/data";
import { TombolPasang } from "@/components/pwa/tombol-pasang";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Beranda",
};

export default function SayaPage() {
  return (
    <Suspense fallback={<Memuat className="mt-8 h-96" />}>
      <BerandaGenerus />
    </Suspense>
  );
}

async function BerandaGenerus() {
  const generus = await wajibGenerus();
  const hariIni = hariIniWib();
  const [kehadiran, jadwal, pengumuman] = await Promise.all([
    getKehadiranSaya(),
    getKalender(hariIni, tambahHari(hariIni, 6), [generus.jamaah.kelompokId]),
    getPengumumanTayang("generus"),
  ]);
  const saran = await getSaranGenerus(generus, jadwal);
  const ringkasan = ringkasKehadiran(kehadiran);
  const sekarang = new Date().toISOString();
  const berikut = jadwal.find((k) => k.status === "terjadwal" && k.selesai > sekarang);
  const berlangsung = berikut && berikut.mulai <= sekarang;
  const namaKelompok = new Map([[generus.jamaah.kelompokId, generus.jamaah.kelompok ?? "Kelompok"]]);
  const sapa = sambutan({
    catatan: kehadiran,
    tanggalLahir: generus.jamaah.tanggalLahir,
    berikut: berikut && { nama: berikut.kegiatan.nama, tanggal: berikut.tanggal, mulai: berikut.mulai },
  });
  // Pekan pertama tiap bulan: ajakan membuka rapor bulan lalu.
  const rapor = Number(hariIni.slice(8, 10)) <= 7 ? raporBulan(kehadiran, bulanLalu()) : null;

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div>
        <p className="text-sm text-muted">Assalamu&apos;alaikum · {sapa.salam}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{generus.jamaah.panggilan ?? generus.jamaah.nama}</h1>
        <p className="text-sm text-muted">
          {[generus.jamaah.kelompok, `@${generus.username}`].filter(Boolean).join(" · ")}
        </p>
        {sapa.pesan && (
          <p className={`mt-3 rounded-card px-4 py-3 text-sm font-medium ${sapa.nada === "syukur" ? "bg-primary-soft text-primary" : "bg-surface"}`}>
            {sapa.pesan}
          </p>
        )}
      </div>

      {/* Urutan: yang paling perlu diketahui dulu (pengajian terdekat &
          pengumuman), baru saran & ajakan pasang aplikasi. */}
      {pengumuman.length > 0 && (
        <DaftarPengumuman pengumuman={pengumuman.map(({ id, pesan, nada }) => ({ id, pesan, nada }))} />
      )}

      {berikut && (
        <Card className={`flex flex-col gap-3 ${berlangsung ? "bg-primary-soft" : ""}`}>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarClock className="size-4" aria-hidden />
            {berlangsung ? "Sedang berlangsung" : `Berikutnya · ${waktuRelatif(berikut.mulai)}`}
          </p>
          <div>
            <p className="text-lg font-semibold">{berikut.kegiatan.nama}</p>
            <p className="text-sm text-muted">{tanggalJam(berikut.mulai)}</p>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4 text-muted" aria-hidden />
              {berikut.pemateri ?? "Pemateri belum diumumkan"}
            </span>
            {berikut.materi && <span className="text-muted">Materi: {berikut.materi}</span>}
            {berikut.kegiatan.lokasi && (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <MapPin className="size-4" aria-hidden />
                {berikut.kegiatan.lokasi}
              </span>
            )}
          </div>
          {berlangsung ? (
            <Link href="/saya/scan" className={buttonClass("utama", "h-14 text-base")}>
              <ScanLine className="size-5" aria-hidden />
              Scan QR absen
            </Link>
          ) : (
            <Link
              href={`/saya/izin?k=${berikut.kegiatan.id}&t=${berikut.tanggal}`}
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary"
            >
              <CalendarX className="size-4" aria-hidden />
              Berhalangan? Ajukan izin
            </Link>
          )}
        </Card>
      )}

      <KartuKehadiran ringkasan={ringkasan} />

      {rapor && rapor.total > 0 && (
        <Link
          href={`/saya/rapor?bulan=${rapor.bulan}`}
          className="flex items-center gap-3 rounded-card bg-surface p-5 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
        >
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Rapor {rapor.judul} sudah siap</span>
            <span className="block text-muted">
              Hadir {rapor.hadir} dari {rapor.total} pertemuan{rapor.lencana.length ? ` · ${rapor.lencana.length} lencana` : ""}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" aria-hidden />
        </Link>
      )}

      <KartuAsisten saran={saran} />
      <TombolPasang />
      <SaklarNotifikasi ringkas />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold text-muted">Jadwal 7 hari ke depan</h2>
          <Link href="/saya/jadwal" className="text-sm font-medium text-primary">
            Lihat semua
          </Link>
        </div>
        <DaftarKejadian
          kejadian={jadwal}
          namaKelompok={namaKelompok}
          tautan={false}
          kosong="Belum ada jadwal kegiatan pekan ini."
          aksi={(k) => <TautanIzin k={k} />}
        />
      </section>

      {kehadiran.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">Kehadiran terakhir</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {kehadiran.slice(0, 3).map((c) => {
              const l = labelKehadiran(c);
              return (
                <li key={c.sesi_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.nama}</span>
                    <span className="block text-sm text-muted">{tanggalJam(c.mulai)}</span>
                  </span>
                  <Badge nada={l.nada}>{l.label}</Badge>
                </li>
              );
            })}
          </ul>
          <Link
            href="/saya/kehadiran"
            className="flex items-center justify-center gap-1 text-sm font-medium text-primary"
          >
            Riwayat lengkap <ChevronRight className="size-4" aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}
