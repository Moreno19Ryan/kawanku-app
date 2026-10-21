import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Printer, Search } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { buatKartuKelompok, gantiKartu } from "@/lib/absensi/actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Kartu QR",
};

type Cari = { q?: string | string[]; kelompok?: string | string[] };
type Baris = { id: string; kode: string; nama_lengkap: string; kelompok_id: string };
type Kartu = { jamaah_id: string; created_at: string };

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function KartuPage({ searchParams }: PageProps<"/absensi/kartu">) {
  return (
    <>
      <Link href="/absensi" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <PageHeader
        title="Kartu QR"
        description="Kartu absensi jalur 1 (ukuran KTP), discan dengan scanner barcode USB."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarKartu cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

async function DaftarKartu({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesAbsensi(), cari]);
  if (!akses || akses.kelompokKelola.length === 0) return <AbsensiBelumMenyala />;

  const pilihan = akses.kelompokKelola;
  const kelompok = pilihan.find((k) => k.id === satu(param.kelompok)) ?? pilihan[0];
  const q = satu(param.q).trim().slice(0, 60).toLowerCase();

  const supabase = await createClient();
  const [{ data: jamaah }, { data: kartu }] = await Promise.all([
    supabase
      .from("jamaah")
      .select("id, kode, nama_lengkap, kelompok_id")
      .eq("kelompok_id", kelompok.id)
      .eq("aktif", true)
      .order("nama_lengkap")
      .returns<Baris[]>(),
    supabase.from("kartu_qr").select("jamaah_id, created_at").eq("aktif", true).returns<Kartu[]>(),
  ]);
  // RLS membatasi keduanya per jamaah (admin generus hanya melihat generus).
  const petaKartu = new Map((kartu ?? []).map((k) => [k.jamaah_id, k]));
  const daftar = (jamaah ?? []).filter(
    (j) => !q || j.nama_lengkap.toLowerCase().includes(q) || j.kode.toLowerCase().includes(q),
  );
  const punya = (jamaah ?? []).filter((j) => petaKartu.has(j.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">{kelompok.nama}</p>
          <p className="text-sm text-muted">
            {punya} dari {jamaah?.length ?? 0} jamaah aktif sudah punya kartu.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <TombolAksi
            aksi={buatKartuKelompok.bind(null, kelompok.id)}
            label="Buat kartu yang belum ada"
            varian="kedua"
          />
          <Link
            href={`/cetak/kartu?kelompok=${kelompok.id}`}
            target="_blank"
            className={buttonClass("utama", "h-9 px-4")}
          >
            <Printer className="size-4" aria-hidden />
            Cetak semua
          </Link>
        </div>
      </Card>

      <form method="get" className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama atau kode jamaah"
            aria-label="Cari jamaah"
            className={`${INPUT_CLASS} w-full pl-11`}
          />
        </div>
        {pilihan.length > 1 && (
          <select name="kelompok" defaultValue={kelompok.id} aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:w-48`}>
            {pilihan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={buttonClass("kedua", "h-12 shrink-0")}>
          Tampilkan
        </button>
      </form>

      {daftar.length === 0 ? (
        <Card className="text-center text-sm text-muted">Tidak ada jamaah yang cocok.</Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {daftar.map((j) => {
            const k = petaKartu.get(j.id);
            return (
              <li key={j.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{j.nama_lengkap}</span>
                    {k ? <Badge nada="sukses">Punya kartu</Badge> : <Badge>Belum ada kartu</Badge>}
                  </span>
                  <span className="block text-sm text-muted">
                    {j.kode}
                    {k ? ` · dibuat ${tanggalJam(k.created_at)}` : ""}
                  </span>
                </span>
                <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                  {k && (
                    <Link
                      href={`/cetak/kartu?jamaah=${j.id}`}
                      target="_blank"
                      className={buttonClass("netral", "h-9 px-4")}
                    >
                      <Printer className="size-4" aria-hidden />
                      Cetak
                    </Link>
                  )}
                  <TombolAksi
                    aksi={gantiKartu.bind(null, j.id)}
                    label={k ? "Ganti kartu" : "Buat kartu"}
                    varian={k ? "bahaya" : "kedua"}
                    konfirmasi={
                      k
                        ? `Ganti kartu ${j.nama_lengkap}? Kartu lama (yang hilang/rusak) tidak bisa dipakai lagi.`
                        : undefined
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 text-xs text-muted">
        Kartu yang hilang atau rusak cukup diganti: kartu lama otomatis tidak berlaku. Penanda keringanan tidak
        dicetak di kartu.
      </p>
    </div>
  );
}
