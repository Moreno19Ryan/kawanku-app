import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import QRCode from "qrcode";
import { TombolCetak } from "@/components/absensi/tombol-cetak";
import { KopDokumen } from "@/components/dokumen/kop-dokumen";
import { KartuQr } from "@/components/kartu/kartu-qr";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cetak kartu QR",
  robots: { index: false },
};

type Cari = { kelompok?: string | string[]; jamaah?: string | string[] };
type Baris = {
  token: string;
  jamaah: { id: string; kode: string; nama_lengkap: string; kelompok_id: string; kelompok: { nama: string } | null };
};

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Lembar cetak kartu QR (A4, 2 × 5 kartu ukuran KTP). Di luar layout admin
 * supaya hanya kartu yang tercetak. Isi QR = token kartu; kode jamaah (KW-)
 * tercetak di bawahnya untuk input manual bila scan gagal.
 */
export default function CetakKartuPage({ searchParams }: PageProps<"/cetak/kartu">) {
  return (
    <div className="min-h-dvh bg-paper px-gutter py-8 text-paper-fg print:p-0">
      <Suspense fallback={<p className="text-sm">Menyiapkan kartu…</p>}>
        <LembarKartu cari={searchParams as Promise<Cari>} />
      </Suspense>
    </div>
  );
}

async function LembarKartu({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesAbsensi(), cari]);
  if (!akses || akses.kelompokKartu.length === 0) {
    return <p className="text-sm">Kamu tidak punya izin mencetak kartu absensi.</p>;
  }

  const kelompok = satu(param.kelompok);
  const jamaah = satu(param.jamaah);
  const supabase = await createClient();
  let query = supabase
    .from("kartu_qr")
    .select("token, jamaah:jamaah_id!inner(id, kode, nama_lengkap, aktif, kelompok_id, kelompok:kelompok_id(nama))")
    .eq("aktif", true)
    .eq("jamaah.aktif", true);
  if (UUID.test(jamaah)) query = query.eq("jamaah_id", jamaah);
  else if (akses.kelompokKartu.some((k) => k.id === kelompok)) query = query.eq("jamaah.kelompok_id", kelompok);
  else {
    return (
      <p className="text-sm">
        Pilih kelompok dulu dari halaman{" "}
        <Link href="/absensi/kartu" className="font-medium underline">
          Kartu QR
        </Link>
        .
      </p>
    );
  }

  const { data } = await query.returns<Baris[]>();
  const kartu = (data ?? []).sort((a, b) => a.jamaah.nama_lengkap.localeCompare(b.jamaah.nama_lengkap, "id"));
  const svg = await Promise.all(
    kartu.map((k) => QRCode.toString(k.token, { type: "svg", margin: 0, errorCorrectionLevel: "M" })),
  );
  const namaKelompok = kartu[0]?.jamaah.kelompok?.nama;

  return (
    <div className="mx-auto flex max-w-[190mm] flex-col gap-6 print:max-w-none print:gap-[4mm]">
      <style>{"@page { size: A4; margin: 10mm; }"}</style>
      <KopDokumen
        judul="Kartu Absensi"
        keterangan={`${kartu.length} kartu${namaKelompok && !jamaah ? ` · ${namaKelompok}` : ""}`}
        hitamPutih
      />
      <div className="flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-paper-muted">
          Cetak dengan skala 100% (tanpa &ldquo;fit to page&rdquo;) supaya ukuran kartu tepat 85,6 × 54 mm.
        </p>
        <TombolCetak />
      </div>
      {kartu.length === 0 ? (
        <p className="text-sm">Belum ada kartu aktif. Buat kartu dulu di halaman Kartu QR.</p>
      ) : (
        <div className="grid grid-cols-1 justify-items-center gap-[4mm] sm:grid-cols-2 print:grid-cols-2">
          {kartu.map((k, i) => (
            <div key={k.token} className="break-inside-avoid">
              <KartuQr
                nama={k.jamaah.nama_lengkap}
                kelompok={k.jamaah.kelompok?.nama ?? ""}
                kode={k.jamaah.kode}
                qr={
                  <span
                    className="block size-full [&>svg]:size-full"
                    // SVG dibuat server dari token (bukan input pengguna).
                    dangerouslySetInnerHTML={{ __html: svg[i] }}
                  />
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
