import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarX, ChevronRight, FileText, LogOut, MapPin, ScanLine, UserRound } from "lucide-react";
import { PanelSambutan } from "@/components/layout/panel-sambutan";
import { TombolTema } from "@/components/tema/tombol-tema";
import { keluarGenerus } from "@/lib/generus/actions";
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

/**
 * Beranda generus = halaman sambutan (docs/pedoman-desain.md): panel biru di
 * atas (area lihat: sapaan & nama), kartu pengajian terdekat "mengambang"
 * di tepinya, lalu pintasan dan isi lain di area sentuh. `data-sambutan`
 * membuat layout menyembunyikan kepala biasa (kepalanya ada di panel).
 */
export default function SayaPage() {
  return (
    <div data-sambutan className="flex flex-col">
      <Suspense
        fallback={
          <>
            <PanelSambutan kanan={<KananPanel />} />
            <Memuat className="mt-8 h-72" />
          </>
        }
      >
        <BerandaGenerus />
      </Suspense>
    </div>
  );
}

/** Tombol putih di kanan atas panel: tema & keluar. */
function KananPanel() {
  return (
    <>
      <TombolTema className="text-white! hover:bg-white/15!" />
      <form action={keluarGenerus}>
        <button
          type="submit"
          aria-label="Keluar"
          title="Keluar"
          className="flex size-11 items-center justify-center rounded-pill text-white transition-colors duration-200 ease-oneui hover:bg-white/15"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </>
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
    berikut: berikut && { nama: berikut.kegiatan.nama, tanggal: berikut.tanggal, mulai: berikut.mulai },
  });
  // Pekan pertama tiap bulan: ajakan membuka rapor bulan lalu.
  const rapor = Number(hariIni.slice(8, 10)) <= 7 ? raporBulan(kehadiran, bulanLalu()) : null;

  const kartuBerikut = berikut && (
    <Card className={`flex flex-col gap-3 ${berlangsung ? "ring-2 ring-primary" : ""}`}>
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
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-primary"
        >
          <CalendarX className="size-4" aria-hidden />
          Berhalangan? Ajukan izin
        </Link>
      )}
    </Card>
  );
  const kehadiranBulanIni = <KartuKehadiran ringkasan={ringkasan} />;

  // Dua versi (docs/pedoman-desain.md): HP = satu kolom berurutan (order-*);
  // laptop = kolom kiri (sambutan, kehadiran, jadwal) & kolom kanan
  // (pintasan, pengumuman, riwayat, ajakan). Pembungkus kolom memakai
  // `contents` di HP supaya urutan HP diatur langsung oleh order-*.
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <div className="order-1 flex flex-col lg:order-none">
          <PanelSambutan kanan={<KananPanel />} kepalaLaptop={false}>
            <p className="text-sm text-white/80 lg:text-base">Assalamu&apos;alaikum · {sapa.salam}</p>
            <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight lg:text-[2rem]">
              {generus.jamaah.panggilan ?? generus.jamaah.nama}
            </h1>
            <p className="mt-1 text-sm text-white/80 lg:text-base">
              {[generus.jamaah.kelompok, `@${generus.username}`].filter(Boolean).join(" · ")}
            </p>
            {/* Kalimat tentang kegiatan terdekat tidak diulang: sudah ada di kartu di bawahnya. */}
            {sapa.pesan && sapa.topik !== "berikut" && (
              <p className="mt-4 rounded-card bg-white/15 px-4 py-3 text-sm font-medium lg:inline-block">{sapa.pesan}</p>
            )}
          </PanelSambutan>

          {/* Kartu yang mengambang di tepi panel: pengajian terdekat, atau
              kehadiran bulan ini bila belum ada jadwal. */}
          <div className="kk-muncul-2 relative -mt-16 sm:mx-4 lg:-mt-20 lg:mx-6 [&>*]:shadow-[0_8px_28px_rgb(0_0_0/0.10)]">
            {kartuBerikut || kehadiranBulanIni}
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-6">
          {kartuBerikut && <div className="order-4 lg:order-none">{kehadiranBulanIni}</div>}
          <div className="order-7 lg:order-none">
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
          </div>
        </div>
      </div>

      <div className="contents lg:mt-6 lg:flex lg:flex-col lg:gap-5">
        <div className="order-3 lg:order-none">
          <Pintasan />
        </div>
        {pengumuman.length > 0 && (
          <div className="order-2 lg:order-none [&>div]:mt-0">
            <DaftarPengumuman pengumuman={pengumuman.map(({ id, pesan, nada }) => ({ id, pesan, nada }))} />
          </div>
        )}
        <div className="order-8 empty:hidden lg:order-none">
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
        <div className="order-5 empty:hidden lg:order-none">
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
        </div>
        <div className="order-6 empty:hidden lg:order-none">
          <KartuAsisten saran={saran} />
        </div>
        <div className="order-9 empty:hidden lg:order-none">
          <SaklarNotifikasi ringkas />
        </div>
        <div className="order-10 empty:hidden lg:order-none">
          <TombolPasang />
        </div>
      </div>
    </div>
  );
}

const PINTASAN = [
  { href: "/saya/izin", label: "Ajukan izin", ikon: CalendarX },
  { href: "/saya/rapor", label: "Rapor", ikon: FileText },
  { href: "/saya/profil", label: "Data diri", ikon: UserRound },
] as const;

/** Pintasan ke halaman yang tidak ada di menu bawah (area sentuh). */
function Pintasan() {
  return (
    <nav aria-label="Pintasan" className="grid grid-cols-3 gap-3">
      {PINTASAN.map(({ href, label, ikon: Ikon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-card bg-surface px-2 py-4 text-sm font-medium transition-colors duration-200 ease-oneui hover:bg-surface-muted"
        >
          <span className="flex size-11 items-center justify-center rounded-pill bg-primary-soft text-primary">
            <Ikon className="size-5" aria-hidden />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
