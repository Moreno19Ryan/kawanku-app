import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleAlert, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { labelPenugasan } from "@/lib/auth/admin";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";
import { getPerluDicek } from "@/lib/jamaah/periksa";
import { getUsulanMenunggu } from "@/lib/jamaah/usulan";
import { createClient } from "@/lib/supabase/server";
import { waktuRelatif } from "@/lib/waktu";

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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Beranda" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="mt-4 h-72" />
        </>
      }
    >
      <Ringkasan />
    </Suspense>
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

async function Ringkasan() {
  const [akses, aturan] = await Promise.all([getAksesJamaah(), getAturanKategori()]);
  if (!akses) return null;
  const { admin } = akses;

  const header = (
    <PageHeader
      title={`${sapaan()}, ${admin.nama.split(" ")[0]}`}
      description={admin.penugasan.map(labelPenugasan).join(" · ")}
      actions={
        akses.kelompokTambah.length > 0 ? (
          <Link href="/jamaah/baru" className={buttonClass("utama")}>
            <Plus className="size-4" aria-hidden />
            Tambah jamaah
          </Link>
        ) : null
      }
    />
  );

  // Modul Jamaah belum terbuka untuk admin ini: tampilkan ringkas saja.
  if (akses.kelompokLihat.length === 0) {
    return (
      <>
        {header}
        <Card className="flex items-start gap-4">
          <Users className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <p className="font-medium">Ringkasan jamaah belum tersedia</p>
            <p className="mt-1 text-sm text-muted">
              Modul Jamaah belum dinyalakan untuk wilayahmu, atau peranmu tidak mencakup data
              jamaah. Buka Pengaturan untuk akun dan wewenangmu.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("jamaah_dengan_kategori")
    .select(
      "id, nama_lengkap, kode, kelompok_id, kategori_jamaah_id, termasuk_generus, jenis_kelamin, tanggal_lahir, tahun_lahir, aktif, created_at",
    )
    .in(
      "kelompok_id",
      akses.kelompokLihat.map((k) => k.id),
    )
    .returns<BarisRingkas[]>();

  if (!data) {
    return (
      <>
        {header}
        <Card className="text-sm text-danger">Gagal memuat ringkasan. Muat ulang halaman.</Card>
      </>
    );
  }

  const aktif = data.filter((j) => j.aktif);
  const generus = aktif.filter((j) => j.termasuk_generus).length;
  const laki = aktif.filter((j) => j.jenis_kelamin === "L").length;
  const nonaktif = data.length - aktif.length;
  const [periksa, usulan] = await Promise.all([getPerluDicek(), getUsulanMenunggu()]);
  const jumlahPerluDicek = periksa?.perJamaah.size ?? 0;
  const ringkasPerluDicek = (periksa?.daftar ?? [])
    .filter((p) => periksa!.hasil[p.kode].length > 0)
    .map((p) => `${p.judul.toLowerCase()} (${periksa!.hasil[p.kode].length})`)
    .join(", ");
  const terbaru = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const namaKelompok = new Map(akses.kelompokLihat.map((k) => [k.id, k.nama]));

  const hitung = (pred: (j: BarisRingkas) => boolean) => aktif.filter(pred).length;
  const kategoriTampil = aturan.filter((k) => !akses.generusSaja || k.termasuk_generus);

  if (data.length === 0) {
    return (
      <>
        {header}
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
      </>
    );
  }

  return (
    <>
      {header}

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

      {(jumlahPerluDicek > 0 || usulan.length > 0) && (
        <Link
          href="/jamaah/periksa"
          className="mt-4 flex items-center gap-3 rounded-card bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors duration-200 ease-oneui hover:bg-surface-muted sm:mt-6 sm:p-6"
        >
          <CircleAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Data perlu dicek</span>
            <span className="block text-muted">
              {[
                usulan.length > 0 && `${usulan.length} laporan data salah dari jamaah`,
                jumlahPerluDicek > 0 && `${jumlahPerluDicek} jamaah: ${ringkasPerluDicek}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
        </Link>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
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

      {akses.kelompokLihat.length > 1 && (
        <div className="mt-4 sm:mt-6">
          <TerbaruKartu terbaru={terbaru} namaKelompok={namaKelompok} />
        </div>
      )}
    </>
  );
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
