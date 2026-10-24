import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import QRCode from "qrcode";
import { TombolCetak } from "@/components/absensi/tombol-cetak";
import { KopDokumen } from "@/components/dokumen/kop-dokumen";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { teksPin } from "@/lib/generus/info-masuk";
import { alamatSitus } from "@/lib/situs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cetak info masuk",
  robots: { index: false },
};

type Cari = { kelompok?: string | string[]; semua?: string | string[] };
type Baris = {
  username: string;
  pin_awal: boolean;
  login_terakhir: string | null;
  jamaah: {
    nama_lengkap: string;
    nama_panggilan: string | null;
    tanggal_lahir: string | null;
    kelompok_id: string;
    kelompok: { nama: string } | null;
  };
};

const satu = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Slip info masuk akun generus (A4, dipotong per slip): alamat + QR ke
 * halaman masuk, username, dan aturan PIN awal (angkanya tidak dicetak).
 * Bawaan: akun yang masih memakai PIN awal; ?semua=1 untuk semua akun aktif.
 */
export default function CetakInfoMasukPage({
  searchParams,
}: PageProps<"/cetak/akun">) {
  return (
    <div className="min-h-dvh bg-paper px-gutter py-8 text-paper-fg print:p-0">
      <Suspense fallback={<p className="text-sm">Menyiapkan slip…</p>}>
        <LembarSlip cari={searchParams as Promise<Cari>} />
      </Suspense>
    </div>
  );
}

async function LembarSlip({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesAbsensi(), cari]);
  const situs = alamatSitus();
  const kelompok = akses?.kelompokAkun.find(
    (k) => k.id === satu(param.kelompok),
  );
  if (!akses || !kelompok) {
    return (
      <p className="text-sm">
        Pilih kelompok dulu dari halaman{" "}
        <Link href="/absensi/akun" className="font-medium underline">
          Akun generus
        </Link>
        .
      </p>
    );
  }
  const semua = satu(param.semua) === "1";
  const supabase = await createClient();
  let q = supabase
    .from("akun_generus")
    .select(
      "username, pin_awal, login_terakhir, jamaah:jamaah_id!inner(nama_lengkap, nama_panggilan, tanggal_lahir, kelompok_id, aktif, kelompok:kelompok_id(nama))",
    )
    .eq("aktif", true)
    .eq("jamaah.aktif", true)
    .eq("jamaah.kelompok_id", kelompok.id);
  if (!semua) q = q.eq("pin_awal", true);
  const { data } = await q.returns<Baris[]>();
  const slip = (data ?? []).sort((a, b) =>
    a.jamaah.nama_lengkap.localeCompare(b.jamaah.nama_lengkap, "id"),
  );
  const alamat = `${situs}/masuk`;
  const qr = await QRCode.toString(alamat, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto flex max-w-[190mm] flex-col gap-6 print:max-w-none print:gap-[4mm]">
      <style>{"@page { size: A4; margin: 10mm; }"}</style>
      <KopDokumen
        judul="Info Masuk Akun Generus"
        keterangan={`${kelompok.nama} · ${slip.length} akun${semua ? "" : " (PIN awal)"}`}
        hitamPutih
      />
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-paper-muted">
          Gunting per slip lalu berikan langsung ke generusnya. Angka PIN tidak
          dicetak.{" "}
          <Link
            href={`/cetak/akun?kelompok=${kelompok.id}${semua ? "" : "&semua=1"}`}
            className="underline"
          >
            {semua ? "Hanya yang masih PIN awal" : "Tampilkan semua akun"}
          </Link>
        </p>
        <TombolCetak />
      </div>
      {slip.length === 0 ? (
        <p className="text-sm">
          {semua
            ? "Belum ada akun generus aktif di kelompok ini."
            : "Semua akun sudah mengganti PIN awalnya."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[4mm] sm:grid-cols-2 print:grid-cols-2">
          {slip.map((s) => (
            <section
              key={s.username}
              className="flex break-inside-avoid gap-4 rounded-lg border border-dashed border-paper-fg/50 p-4 text-sm"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="font-bold">
                  Assalamu&apos;alaikum,{" "}
                  {s.jamaah.nama_panggilan ||
                    s.jamaah.nama_lengkap.split(" ")[0]}
                </p>
                <p className="text-xs text-paper-muted">
                  {s.jamaah.nama_lengkap} · {s.jamaah.kelompok?.nama}
                </p>
                <p>
                  1. Buka{" "}
                  <span className="font-semibold break-all">{alamat}</span>{" "}
                  (atau scan QR)
                </p>
                <p>
                  2. Username:{" "}
                  <span className="font-mono font-bold">{s.username}</span>
                </p>
                <p>3. {teksPin(s.pin_awal, Boolean(s.jamaah.tanggal_lahir))}</p>
                <p className="text-xs text-paper-muted">
                  Setelah masuk, ganti PIN dan jangan beri tahu siapa pun.
                  Pasang di layar utama HP supaya mudah dibuka.
                </p>
              </div>
              <span
                className="block size-24 shrink-0 [&>svg]:size-full"
                // SVG dibuat server dari alamat aplikasi (bukan input pengguna).
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
