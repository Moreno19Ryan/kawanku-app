import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, Megaphone, Settings2 } from "lucide-react";
import { DaftarKejadian, hrefPertemuan } from "@/components/kegiatan/daftar-kejadian";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { bolehKelolaPertemuan, getAksesKegiatan } from "@/lib/kegiatan/akses";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { jam, waktuRelatif } from "@/lib/waktu";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Kegiatan",
};

type Cari = { kelompok?: string | string[]; rentang?: string | string[] };
const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const RENTANG = { "7": "7 hari", "14": "14 hari", "30": "30 hari" } as const;

export default function KegiatanPage({ searchParams }: PageProps<"/kegiatan">) {
  return (
    <Suspense fallback={<Memuat className="mt-10 h-96" />}>
      <Kalender cari={searchParams as Promise<Cari>} />
    </Suspense>
  );
}

async function Kalender({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesKegiatan(), cari]);
  if (!akses || akses.kelompokLihat.length === 0) return <KegiatanBelumMenyala />;

  const pilihan = akses.kelompokLihat;
  const kelompok = pilihan.find((k) => k.id === satu(param.kelompok));
  const kelompokIds = kelompok ? [kelompok.id] : pilihan.map((k) => k.id);
  const rentang = (satu(param.rentang) in RENTANG ? satu(param.rentang) : "14") as keyof typeof RENTANG;
  const hariIni = hariIniWib();
  const kejadian = await getKalender(hariIni, tambahHari(hariIni, Number(rentang) - 1), kelompokIds);
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const sekarang = new Date().toISOString();
  const berikut = kejadian.find((k) => k.status === "terjadwal" && k.selesai > sekarang);
  // Hanya pertemuan yang bisa diisi admin ini.
  const tanpaPemateri = kejadian.filter(
    (k) =>
      k.status === "terjadwal" &&
      !k.pemateri &&
      k.tanggal <= tambahHari(hariIni, 6) &&
      bolehKelolaPertemuan(akses, k.kelompokId, k.kegiatan.hanya_generus),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kegiatan"
        description="Jadwal pengajian & agenda jamaah, pemateri, materi, dan absensinya."
        actions={
          akses.targetKegiatan.length > 0 ? (
            <>
              <Link href="/kegiatan/pengumuman" className={buttonClass("kedua")}>
                <Megaphone className="size-4" aria-hidden />
                Pengumuman generus
              </Link>
              <Link href="/kegiatan/kelola" className={buttonClass("kedua")}>
                <Settings2 className="size-4" aria-hidden />
                Kelola kegiatan
              </Link>
            </>
          ) : null
        }
      />

      {berikut && (
        <Link
          href={hrefPertemuan(berikut)}
          className="flex items-center gap-4 rounded-card bg-primary-soft px-5 py-4 text-primary transition-colors duration-200 ease-oneui hover:bg-primary-soft/70"
        >
          <CalendarClock className="size-8 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm">
              {berikut.mulai <= sekarang ? "Sedang berlangsung" : `Berikutnya · ${waktuRelatif(berikut.mulai)}`}
            </span>
            <span className="block truncate text-lg font-semibold">
              {berikut.kegiatan.nama}
              {berikut.kelompokId ? ` · ${namaKelompok.get(berikut.kelompokId)}` : ""} · {jam(berikut.mulai)}
            </span>
            <span className="block text-sm">{berikut.pemateri ? `Pemateri: ${berikut.pemateri}` : "Pemateri belum diisi"}</span>
          </span>
        </Link>
      )}
      {tanpaPemateri > 0 && (
        <Card className="text-sm">
          <span className="font-semibold">{tanpaPemateri} pertemuan</span> dalam 7 hari ke depan belum ada
          pematerinya. Ketuk pertemuannya untuk mengisi.
        </Card>
      )}

      <FormOtomatis className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
        {pilihan.length > 1 && (
          <select name="kelompok" defaultValue={kelompok?.id ?? ""} aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:flex-1`}>
            <option value="">Semua kelompok</option>
            {pilihan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        )}
        <select name="rentang" defaultValue={rentang} aria-label="Rentang" className={`${INPUT_CLASS} w-full sm:w-40`}>
          {Object.entries(RENTANG).map(([v, l]) => (
            <option key={v} value={v}>
              {l} ke depan
            </option>
          ))}
        </select>
      </FormOtomatis>

      <DaftarKejadian kejadian={kejadian} namaKelompok={namaKelompok} />
    </div>
  );
}
