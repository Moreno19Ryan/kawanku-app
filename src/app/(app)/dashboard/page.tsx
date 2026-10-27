import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, CalendarX, ChartColumn, ChevronRight, Plus, QrCode, UserPlus, Users } from "lucide-react";
import { KartuHariIni } from "@/components/absensi/kartu-hari-ini";
import { AkunAdmin } from "@/components/auth/akun-admin";
import { PanelSambutan } from "@/components/layout/panel-sambutan";
import { TombolTema } from "@/components/tema/tombol-tema";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { labelPenugasan } from "@/lib/auth/admin";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { labelTahunAjaran, masaKenaikan, tahunAjaran } from "@/lib/jamaah/kenaikan";
import { hitungBelumNaik } from "@/lib/jamaah/kenaikan-data";
import { getPerluDicek } from "@/lib/jamaah/periksa";
import { getPerubahanGenerus } from "@/lib/jamaah/perubahan";
import { getUsulanMenunggu } from "@/lib/jamaah/usulan";
import { createClient } from "@/lib/supabase/server";
import { waktuRelatif } from "@/lib/waktu";
import { KartuAsisten } from "@/components/asisten/kartu-asisten";
import { getSaranAdmin } from "@/lib/asisten/data";
import { SaklarNotifikasi } from "@/components/generus/saklar-notifikasi";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Beranda",
};

type BarisRingkas = {
  id: string;
  nama_lengkap: string;
  kode: string;
  kelompok_id: string;
  kategori_jamaah_id: string | null;
  termasuk_generus: boolean;
  jenis_kelamin: "L" | "P";
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  aktif: boolean;
  created_at: string;
};

/**
 * Beranda admin = halaman sambutan (docs/pedoman-desain.md, sama dengan
 * Beranda generus): panel biru (salam, nama, peran, kalimat ringkas hari
 * ini), kartu "Hari ini" yang mengambang di tepinya, lalu pintasan sesuai
 * wewenang & "Perlu perhatian" (laptop: kolom kanan), angka, dan rincian.
 */
export default function DashboardPage() {
  return (
    <div data-sambutan>
      <Suspense
        fallback={
          <>
            <PanelSambutan kepalaLaptop={false} />
            <Memuat className="mt-8 h-72" />
          </>
        }
      >
        <Ringkasan />
      </Suspense>
    </div>
  );
}

function sapaan(): string {
  const jam = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(
      new Date(),
    ),
  );
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Angka utama (stat tile). */
function Angka({
  label,
  nilai,
  keterangan,
  href,
}: {
  label: string;
  nilai: number;
  keterangan?: string;
  href?: string;
}) {
  const isi = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{nilai.toLocaleString("id-ID")}</p>
      {keterangan && <p className="text-xs text-muted">{keterangan}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-card bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors duration-200 ease-oneui hover:bg-surface-muted sm:p-6"
    >
      {isi}
    </Link>
  ) : (
    <Card className="flex flex-col gap-1.5">{isi}</Card>
  );
}

/**
 * Daftar batang horizontal satu warna (satu seri → tanpa legenda; judul kartu
 * menamainya). Setiap baris tautan ke daftar jamaah terfilter, dengan label &
 * angka tertulis, jadi tidak bergantung pada warna.
 */
function DaftarBatang({
  judul,
  baris,
}: {
  judul: string;
  baris: { label: string; nilai: number; href: string; catatan?: string }[];
}) {
  const maks = Math.max(1, ...baris.map((b) => b.nilai));
  const total = baris.reduce((n, b) => n + b.nilai, 0);
  return (
    <Card>
      <h2 className="text-lg font-semibold">{judul}</h2>
      <ul className="mt-4 flex flex-col gap-1">
        {baris.map((b) => (
          <li key={b.label}>
            <Link
              href={b.href}
              title={`${b.label}: ${b.nilai} jamaah${total ? ` (${Math.round((b.nilai / total) * 100)}%)` : ""}`}
              className="-mx-2 flex flex-col gap-1.5 rounded-control px-2 py-2 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {b.label}
                  {b.catatan && <span className="text-muted"> · {b.catatan}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{b.nilai}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-pill bg-surface-muted" aria-hidden>
                <span
                  className="block h-full rounded-pill bg-primary"
                  style={{ width: `${b.nilai === 0 ? 0 : Math.max(2, (b.nilai / maks) * 100)}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** HP: semua pintasan dalam satu baris (jumlahnya sesuai wewenang). */
const KOLOM_PINTASAN: Record<number, string> = {
  1: "grid-cols-2",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

type RingkasanHari = { pertemuan: number; tanpa_pemateri: number; izin: number };

async function Ringkasan() {
  const [akses, aturan, aksesAbsensi, aksesKegiatan, supabase] = await Promise.all([
    getAksesJamaah(),
    getAturanKategori(),
    getAksesAbsensi(),
    getAksesKegiatan(),
    createClient(),
  ]);
  if (!akses) return null;
  const { admin } = akses;
  const jamaahTerbuka = akses.kelompokLihat.length > 0;

  const [{ data: hari }, { data }, periksa, usulan, perubahan, belumNaik] = await Promise.all([
    supabase.rpc("ringkasan_hari_ini"),
    jamaahTerbuka
      ? supabase
          .from("jamaah_dengan_kategori")
          .select(
            "id, nama_lengkap, kode, kelompok_id, kategori_jamaah_id, termasuk_generus, jenis_kelamin, tanggal_lahir, tahun_lahir, aktif, created_at",
          )
          .in(
            "kelompok_id",
            akses.kelompokLihat.map((k) => k.id),
          )
          .returns<BarisRingkas[]>()
      : Promise.resolve({ data: [] as BarisRingkas[] }),
    jamaahTerbuka ? getPerluDicek() : Promise.resolve(null),
    jamaahTerbuka ? getUsulanMenunggu() : Promise.resolve([]),
    jamaahTerbuka ? getPerubahanGenerus() : Promise.resolve([]),
    // Pengingat kenaikan kelas hanya Juli–September, untuk yang boleh mengubah.
    jamaahTerbuka && masaKenaikan() ? hitungBelumNaik(akses.kelompokUbah.map((k) => k.id)) : Promise.resolve(0),
  ]);
  const r = hari as RingkasanHari | null;

  const kalimat = r
    ? [
        r.pertemuan > 0 ? `Hari ini ${r.pertemuan} pertemuan` : "Hari ini tidak ada pertemuan",
        r.izin > 0 && `${r.izin} izin menunggu persetujuan`,
      ]
        .filter(Boolean)
        .join(", ") + "."
    : null;

  const panel = (
    <PanelSambutan
      kepalaLaptop={false}
      kanan={
        <>
          <TombolTema className="text-white! hover:bg-white/15!" />
          <Suspense fallback={<div className="size-8" />}>
            <AkunAdmin ringkas terang />
          </Suspense>
        </>
      }
    >
      <p className="text-sm text-white/80 lg:text-base">Assalamu&apos;alaikum · {sapaan()}</p>
      <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight lg:text-[2rem]">
        {admin.nama.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-white/80 lg:text-base">{admin.penugasan.map(labelPenugasan).join(" · ")}</p>
      {kalimat && <p className="mt-4 rounded-card bg-white/15 px-4 py-3 text-sm font-medium lg:inline-block">{kalimat}</p>}
    </PanelSambutan>
  );

  // Pintasan hanya untuk yang memang berwenang.
  const pintasan = [
    akses.kelompokTambah.length > 0 && { href: "/jamaah/baru", label: "Tambah jamaah", ikon: UserPlus },
    aksesAbsensi && aksesAbsensi.kelompokKelola.length > 0 && {
      href: "/absensi/izin",
      label: "Izin masuk",
      ikon: CalendarX,
      angka: r?.izin ?? 0,
    },
    aksesAbsensi?.bolehLihat && { href: "/absensi/laporan", label: "Laporan", ikon: ChartColumn },
    aksesKegiatan && aksesKegiatan.kelompokLihat.length > 0 && { href: "/kegiatan", label: "Kegiatan", ikon: CalendarDays },
    aksesAbsensi && aksesAbsensi.kelompokKartu.length > 0 && { href: "/absensi/kartu", label: "Kartu QR", ikon: QrCode },
  ].filter((p) => !!p);

  const jumlahPerluDicek = periksa?.perJamaah.size ?? 0;
  const perhatian = [
    jumlahPerluDicek > 0 && { href: "/jamaah/periksa", teks: `${jumlahPerluDicek} data jamaah perlu dicek`, penting: true },
    usulan.length > 0 && { href: "/jamaah/periksa", teks: `${usulan.length} laporan data salah dari jamaah`, penting: true },
    perubahan.length > 0 && { href: "/jamaah/periksa", teks: `${perubahan.length} generus memperbarui datanya` },
    (r?.tanpa_pemateri ?? 0) > 0 && {
      href: "/kegiatan",
      teks: `${r!.tanpa_pemateri} pertemuan hari ini/besok belum ada pemateri`,
    },
    belumNaik > 0 && {
      href: "/jamaah/kenaikan-kelas",
      teks: `Kenaikan kelas ${labelTahunAjaran(tahunAjaran())}: ${belumNaik} jamaah belum dinaikkan`,
    },
  ].filter((p) => !!p);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start">
      <div className="flex flex-col">
        {panel}
        {/* Kartu yang mengambang di tepi bawah panel. */}
        <div className="kk-muncul-2 relative -mt-16 sm:mx-4 lg:-mt-20 lg:mx-6 [&>*]:shadow-[0_8px_28px_rgb(0_0_0/0.10)]">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <KartuHariIni />
          </Suspense>
        </div>
      </div>

      <aside className="flex flex-col gap-4 sm:gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-6">
        {pintasan.length > 0 && (
          <nav
            aria-label="Pintasan"
            className={`grid gap-2 lg:grid-cols-2 lg:gap-3 lg:rounded-card lg:bg-surface lg:p-4 ${KOLOM_PINTASAN[pintasan.length] ?? "grid-cols-4"}`}
          >
            {pintasan.map(({ href, label, ikon: Ikon, ...p }) => (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-1.5 rounded-card bg-surface px-1 py-3 text-center text-xs font-medium transition-colors duration-200 ease-oneui hover:bg-surface-muted lg:items-start lg:bg-bg lg:p-3.5 lg:text-left lg:text-sm"
              >
                {"angka" in p && (p.angka ?? 0) > 0 && (
                  <span className="absolute top-1.5 right-2 flex h-5 min-w-5 items-center justify-center rounded-pill bg-warning px-1.5 text-[0.7rem] font-bold text-white">
                    {p.angka}
                  </span>
                )}
                <span className="flex size-10 items-center justify-center rounded-pill bg-primary-soft text-primary">
                  <Ikon className="size-[1.125rem]" aria-hidden />
                </span>
                {label}
              </Link>
            ))}
          </nav>
        )}

        <section className="flex flex-col gap-2 lg:rounded-card lg:bg-surface lg:p-5">
          <h2 className="px-1 text-sm font-semibold text-muted lg:px-0 lg:text-lg lg:text-fg">Perlu perhatian</h2>
          {perhatian.length === 0 ? (
            <p className="rounded-card bg-surface px-5 py-4 text-sm text-muted lg:p-0">
              Alhamdulillah, tidak ada yang perlu ditindaklanjuti.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface lg:rounded-none">
              {perhatian.map((p) => (
                <li key={p.teks}>
                  <Link
                    href={p.href}
                    className="flex min-h-13 items-center gap-3 px-5 py-3 text-sm transition-colors duration-200 ease-oneui hover:bg-surface-muted lg:px-0 lg:hover:bg-transparent lg:hover:text-primary"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-pill ${"penting" in p && p.penting ? "bg-warning" : "bg-primary"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">{p.teks}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Suspense fallback={<Skeleton className="h-28" />}>
          <AsistenAdmin />
        </Suspense>
        <SaklarNotifikasi ringkas untuk="admin" />
      </aside>

      <div className="flex flex-col gap-4 sm:gap-6">
        <BadanRingkasan akses={akses} aturan={aturan} data={data} />
      </div>
    </div>
  );
}

/** Angka utama & rincian jamaah (di bawah kartu Hari ini). */
function BadanRingkasan({
  akses,
  aturan,
  data,
}: {
  akses: NonNullable<Awaited<ReturnType<typeof getAksesJamaah>>>;
  aturan: Awaited<ReturnType<typeof getAturanKategori>>;
  data: BarisRingkas[] | null;
}) {
  // Modul Jamaah belum terbuka untuk admin ini: tampilkan ringkas saja.
  if (akses.kelompokLihat.length === 0) {
    return (
      <Card className="flex items-start gap-4">
        <Users className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        <div>
          <p className="font-medium">Ringkasan jamaah belum tersedia</p>
          <p className="mt-1 text-sm text-muted">
            Modul Jamaah belum dinyalakan untuk wilayah ini, atau peran akun ini belum mencakup
            data jamaah. Rinciannya ada di Pengaturan → Wewenang saya.
          </p>
        </div>
      </Card>
    );
  }

  if (!data) {
    return <Card className="text-sm text-danger">Mohon maaf, ringkasan belum berhasil dimuat. Silakan muat ulang halaman.</Card>;
  }

  if (data.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Users className="size-10 text-muted" aria-hidden />
        <p className="text-lg font-semibold">Belum ada data jamaah</p>
        <p className="max-w-md text-sm text-muted">
          {akses.kelompokTambah.length > 0
            ? "Ringkasan akan muncul di sini setelah jamaah pertama ditambahkan."
            : "Ringkasan akan muncul di sini setelah admin kelompok menambahkan data jamaah."}
        </p>
        {akses.kelompokTambah.length > 0 && (
          <Link href="/jamaah/baru" className={buttonClass("utama", "mt-2")}>
            <Plus className="size-4" aria-hidden />
            Tambah jamaah pertama
          </Link>
        )}
      </Card>
    );
  }

  const aktif = data.filter((j) => j.aktif);
  const generus = aktif.filter((j) => j.termasuk_generus).length;
  const laki = aktif.filter((j) => j.jenis_kelamin === "L").length;
  const nonaktif = data.length - aktif.length;
  const terbaru = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const namaKelompok = new Map(akses.kelompokLihat.map((k) => [k.id, k.nama]));
  const hitung = (pred: (j: BarisRingkas) => boolean) => aktif.filter(pred).length;
  const kategoriTampil = aturan.filter((k) => !akses.generusSaja || k.termasuk_generus);

  return (
    <>
      <section
        aria-label="Angka utama"
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${akses.generusSaja ? "sm:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        <Angka
          label={akses.generusSaja ? "Jamaah generus" : "Jamaah aktif"}
          nilai={aktif.length}
          keterangan={nonaktif > 0 ? `${nonaktif} nonaktif` : undefined}
          href="/jamaah"
        />
        {!akses.generusSaja && (
          <Angka
            label="Generus"
            nilai={generus}
            keterangan={aktif.length ? `${Math.round((generus / aktif.length) * 100)}% dari jamaah aktif` : undefined}
          />
        )}
        <Angka label="Laki-laki" nilai={laki} />
        <Angka label="Perempuan" nilai={aktif.length - laki} />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <DaftarBatang
          judul="Per kategori"
          baris={kategoriTampil.map((k) => ({
            label: k.nama,
            catatan: k.termasuk_generus && !akses.generusSaja ? "Generus" : undefined,
            nilai: hitung((j) => j.kategori_jamaah_id === k.id),
            href: `/jamaah?kategori=${k.id}`,
          }))}
        />
        {akses.kelompokLihat.length > 1 ? (
          <DaftarBatang
            judul="Per kelompok"
            baris={akses.kelompokLihat.map((k) => ({
              label: k.nama,
              nilai: hitung((j) => j.kelompok_id === k.id),
              href: `/jamaah?kelompok=${k.id}`,
            }))}
          />
        ) : (
          <TerbaruKartu terbaru={terbaru} namaKelompok={null} />
        )}
      </div>

      {akses.kelompokLihat.length > 1 && <TerbaruKartu terbaru={terbaru} namaKelompok={namaKelompok} />}
    </>
  );
}

/** Asisten KawanKu: dimuat terpisah supaya angka utama tampil lebih dulu. */
async function AsistenAdmin() {
  const saran = await getSaranAdmin();
  return <KartuAsisten saran={saran} />;
}

function TerbaruKartu({
  terbaru,
  namaKelompok,
}: {
  terbaru: BarisRingkas[];
  namaKelompok: Map<string, string> | null;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Baru ditambahkan</h2>
        <Link href="/jamaah" className="text-sm font-medium text-primary">
          Lihat semua
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {terbaru.map((j) => (
          <li key={j.id}>
            <Link
              href={`/jamaah/${j.id}`}
              className="-mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {j.nama_lengkap}
                  {!j.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
                </span>
                <span className="block truncate text-sm text-muted">
                  {[j.kode, namaKelompok?.get(j.kelompok_id), waktuRelatif(j.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
