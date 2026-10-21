import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Jamaah",
};

const PER_HALAMAN = 50;

type Cari = { q?: string; kelompok?: string; kategori?: string; status?: string; hal?: string };

type BarisJamaah = {
  id: string;
  kode: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: "L" | "P";
  usia: number | null;
  kelompok_id: string;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
  aktif: boolean;
};

export default function JamaahPage({ searchParams }: PageProps<"/jamaah">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Jamaah" />
          <Skeleton className="h-96" />
        </>
      }
    >
      <DaftarJamaah cari={searchParams as Promise<Cari>} />
    </Suspense>
  );
}

/** Buang karakter yang bermakna khusus di filter PostgREST. */
function bersihkan(teks: string): string {
  return teks.replace(/[,()*%\\:"]/g, " ").trim().slice(0, 60);
}

function satu(nilai: string | string[] | undefined): string {
  return (Array.isArray(nilai) ? nilai[0] : nilai) ?? "";
}

async function DaftarJamaah({ cari }: { cari: Promise<Cari> }) {
  const [akses, aturan, param] = await Promise.all([getAksesJamaah(), getAturanKategori(), cari]);
  if (!akses || akses.kelompokLihat.length === 0) {
    return (
      <>
        <PageHeader title="Jamaah" />
        <JamaahBelumMenyala />
      </>
    );
  }

  const q = bersihkan(satu(param.q));
  const kelompok = satu(param.kelompok);
  const kategori = satu(param.kategori);
  const status = ["nonaktif", "semua"].includes(satu(param.status)) ? satu(param.status) : "aktif";
  const hal = Math.max(1, Number.parseInt(satu(param.hal), 10) || 1);

  const kelompokIds = akses.kelompokLihat.map((k) => k.id);
  const namaKelompok = new Map(akses.kelompokLihat.map((k) => [k.id, k.nama]));

  const supabase = await createClient();
  let kueri = supabase
    .from("jamaah_dengan_kategori")
    .select(
      "id, kode, nama_lengkap, nama_panggilan, jenis_kelamin, usia, kelompok_id, kategori_jamaah_nama, termasuk_generus, aktif",
      { count: "exact" },
    )
    // Hanya kelompok yang modul Jamaah-nya menyala; batas wewenang = RLS.
    .in("kelompok_id", kelompokIds.includes(kelompok) ? [kelompok] : kelompokIds);
  if (q) kueri = kueri.or(`nama_lengkap.ilike.%${q}%,nama_panggilan.ilike.%${q}%,kode.ilike.%${q}%`);
  if (kategori === "tanpa") kueri = kueri.is("kategori_jamaah_id", null);
  else if (aturan.some((k) => k.id === kategori)) kueri = kueri.eq("kategori_jamaah_id", kategori);
  if (status !== "semua") kueri = kueri.eq("aktif", status === "aktif");

  const { data: jamaah, count } = await kueri
    .order("nama_lengkap")
    .range((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN - 1)
    .returns<BarisJamaah[]>();

  // Penanda keringanan hanya untuk admin yang berizin (RLS menyaring sisanya).
  const keringanan = new Set<string>();
  if (akses.bolehLihatKeringanan && jamaah?.length) {
    const { data } = await supabase
      .from("jamaah_keringanan")
      .select("jamaah_id")
      .eq("aktif", true)
      .in(
        "jamaah_id",
        jamaah.map((j) => j.id),
      );
    for (const k of data ?? []) keringanan.add(k.jamaah_id);
  }

  const total = count ?? 0;
  const jumlahHal = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const keHal = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (kelompok) u.set("kelompok", kelompok);
    if (kategori) u.set("kategori", kategori);
    if (status !== "aktif") u.set("status", status);
    if (n > 1) u.set("hal", String(n));
    const s = u.toString();
    return s ? `/jamaah?${s}` : "/jamaah";
  };
  const adaFilter = Boolean(q || kelompok || kategori || status !== "aktif");

  return (
    <>
      <PageHeader
        title="Jamaah"
        description={
          akses.generusSaja
            ? "Jamaah berkategori generus di wilayah tugasmu."
            : `Data jamaah ${akses.kelompokLihat.map((k) => k.nama).join(", ")}.`
        }
        actions={
          akses.kelompokTambah.length > 0 ? (
            <Link href="/jamaah/baru" className={buttonClass("utama")}>
              <Plus className="size-4" aria-hidden />
              Tambah jamaah
            </Link>
          ) : null
        }
      />

      <form method="get" action="/jamaah" className="mb-4 flex flex-col gap-3 rounded-card bg-surface p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama, panggilan, atau kode KW-…"
            aria-label="Cari jamaah"
            className={`${INPUT_CLASS} w-full pl-11`}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {akses.kelompokLihat.length > 1 && (
            <select name="kelompok" defaultValue={kelompok} aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:flex-1`}>
              <option value="">Semua kelompok</option>
              {akses.kelompokLihat.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          )}
          <select name="kategori" defaultValue={kategori} aria-label="Kategori" className={`${INPUT_CLASS} w-full sm:flex-1`}>
            <option value="">Semua kategori</option>
            {aturan
              .filter((k) => !akses.generusSaja || k.termasuk_generus)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            {!akses.generusSaja && <option value="tanpa">Tanpa kategori</option>}
          </select>
          <select name="status" defaultValue={status} aria-label="Status" className={`${INPUT_CLASS} w-full sm:w-44`}>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
            <option value="semua">Semua status</option>
          </select>
          <button type="submit" className={buttonClass("kedua", "h-12 shrink-0")}>
            Terapkan
          </button>
        </div>
      </form>

      <div className="mb-3 flex items-center justify-between gap-3 px-1 text-sm text-muted">
        <p>
          {total} jamaah{adaFilter ? " cocok" : ""}
          {jumlahHal > 1 && ` · halaman ${hal} dari ${jumlahHal}`}
        </p>
        {adaFilter && (
          <Link href="/jamaah" className="font-medium text-primary">
            Hapus filter
          </Link>
        )}
      </div>

      {!jamaah ? (
        <Card className="text-sm text-danger">Gagal memuat data jamaah. Muat ulang halaman.</Card>
      ) : jamaah.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          {adaFilter
            ? "Tidak ada jamaah yang cocok dengan pencarian ini."
            : akses.kelompokTambah.length > 0
              ? "Belum ada data jamaah. Mulai dengan tombol Tambah jamaah."
              : "Belum ada data jamaah yang bisa kamu lihat."}
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {jamaah.map((j) => (
            <li key={j.id}>
              <Link
                href={`/jamaah/${j.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-sm font-semibold text-primary"
                >
                  {j.nama_lengkap.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{j.nama_lengkap}</span>
                    {j.nama_panggilan && <span className="text-sm text-muted">({j.nama_panggilan})</span>}
                    <span className="sm:hidden">
                      {j.kategori_jamaah_nama ? (
                        <Badge nada={j.termasuk_generus ? "utama" : "netral"}>{j.kategori_jamaah_nama}</Badge>
                      ) : (
                        <Badge nada="bahaya">Tanpa kategori</Badge>
                      )}
                    </span>
                    {!j.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
                    {keringanan.has(j.id) && <Badge>Keringanan</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {[
                      j.kode,
                      j.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
                      j.usia !== null ? `${j.usia} th` : null,
                      akses.kelompokLihat.length > 1 ? namaKelompok.get(j.kelompok_id) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="hidden shrink-0 sm:block">
                  {j.kategori_jamaah_nama ? (
                    <Badge nada={j.termasuk_generus ? "utama" : "netral"}>{j.kategori_jamaah_nama}</Badge>
                  ) : (
                    <Badge nada="bahaya">Tanpa kategori</Badge>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {jumlahHal > 1 && (
        <nav aria-label="Halaman" className="mt-4 flex items-center justify-between gap-3">
          {hal > 1 ? (
            <Link href={keHal(hal - 1)} className={buttonClass("netral")}>
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          {hal < jumlahHal && (
            <Link href={keHal(hal + 1)} className={buttonClass("netral")}>
              Berikutnya
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
