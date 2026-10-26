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
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { buatKartuKelompok, gantiKartu } from "@/lib/absensi/actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Kartu QR",
};

type Cari = { q?: string | string[]; kelompok?: string | string[] };
type Baris = { id: string; kode: string; nama_lengkap: string; kelompok_id: string; termasuk_generus: boolean };
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
      <Suspense fallback={<Memuat className="h-96" />}>
        <DaftarKartu cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

async function DaftarKartu({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesAbsensi(), cari]);
  if (!akses || akses.kelompokKartu.length === 0) return <AbsensiBelumMenyala />;

  const pilihan = akses.kelompokKartu;
  const kelompok = pilihan.find((k) => k.id === satu(param.kelompok)) ?? pilihan[0];
  const q = satu(param.q).trim().slice(0, 60).toLowerCase();

  const supabase = await createClient();
  const [{ data: jamaah }, { data: kartu }, { data: keringanan }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select("id, kode, nama_lengkap, kelompok_id, termasuk_generus")
      .eq("kelompok_id", kelompok.id)
      .eq("aktif", true)
      .order("nama_lengkap")
      .returns<Baris[]>(),
    supabase.from("kartu_qr").select("jamaah_id, created_at").eq("aktif", true).returns<Kartu[]>(),
    supabase.from("jamaah_keringanan").select("jamaah_id").eq("aktif", true).returns<{ jamaah_id: string }[]>(),
  ]);
  // RLS membatasi keduanya per jamaah (admin generus hanya melihat generus).
  const petaKartu = new Map((kartu ?? []).map((k) => [k.jamaah_id, k]));
  const daftar = (jamaah ?? []).filter(
    (j) => !q || j.nama_lengkap.toLowerCase().includes(q) || j.kode.toLowerCase().includes(q),
  );
  // Generus absen lewat akun (jalur 2); kartu fisik hanya untuk yang berpenanda keringanan.
  const adaKeringanan = new Set((keringanan ?? []).map((k) => k.jamaah_id));
  const bolehKartu = (j: Baris) => !j.termasuk_generus || adaKeringanan.has(j.id);
  const berhak = (jamaah ?? []).filter(bolehKartu);
  const punya = berhak.filter((j) => petaKartu.has(j.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">{kelompok.nama}</p>
          <p className="text-sm text-muted">
            {punya} dari {berhak.length} jamaah yang memakai kartu sudah punya kartu.
            {berhak.length < (jamaah?.length ?? 0) &&
              ` ${(jamaah?.length ?? 0) - berhak.length} generus absen lewat akunnya.`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <TombolAksi
            aksi={buatKartuKelompok.bind(null, kelompok.id)}
            label="Buat kartu yang belum ada"
            tampilkanPesan
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

      <FormOtomatis className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
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
      </FormOtomatis>

      {daftar.length === 0 ? (
        <Card className="text-center text-sm text-muted">Tidak ada jamaah yang cocok.</Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {daftar.map((j) => {
            const k = petaKartu.get(j.id);
            if (!bolehKartu(j)) {
              return (
                <li key={j.id} className="flex flex-col gap-1 px-5 py-4">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{j.nama_lengkap}</span>
                    <Badge>Pakai akun generus</Badge>
                  </span>
                  <span className="block text-sm text-muted">
                    {j.kode} · absen dengan scan QR layar. Beri penanda keringanan bila tidak punya HP.
                  </span>
                </li>
              );
            }
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
        Kartu yang hilang atau rusak cukup diganti: kartu lama otomatis tidak berlaku. Generus memakai akun;
        kartu fisik generus hanya untuk yang berpenanda keringanan (dicabut otomatis bila penandanya dicabut).
        Penanda keringanan tidak dicetak di kartu.
      </p>
    </div>
  );
}
