import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarPlus, ChartColumn, ChartLine, ChevronRight, IdCard, MailQuestion, UserRound } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { PertemuanHariIni } from "@/components/absensi/pertemuan-hari-ini";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAksesAbsensi, jendelaScan, KOLOM_SESI, type Sesi } from "@/lib/absensi/akses";
import { getPengajuanIzin } from "@/lib/absensi/izin";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Absensi",
};

export default function AbsensiPage() {
  return (
    <>
      <PageHeader
        title="Absensi"
        description="Absensi setiap pertemuan kegiatan, scan kartu QR, dan rekap kehadiran."
        actions={
          <Suspense fallback={null}>
            <AksiAbsensi />
          </Suspense>
        }
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <DaftarSesi />
      </Suspense>
    </>
  );
}

/** Tombol ke halaman lain hanya bila modul Absensi tersedia untuk admin ini. */
async function AksiAbsensi() {
  const akses = await getAksesAbsensi();
  if (!akses?.bolehLihat) return null;
  return (
    <>
      <Link href="/absensi/laporan" className={buttonClass("kedua")}>
        <ChartLine className="size-4" aria-hidden />
        Laporan
      </Link>
      <Link href="/absensi/rekap" className={buttonClass("kedua")}>
        <ChartColumn className="size-4" aria-hidden />
        Rekap
      </Link>
      {akses.kelompokAkun.length > 0 && (
        <Link href="/absensi/akun" className={buttonClass("kedua")}>
          <UserRound className="size-4" aria-hidden />
          Akun generus
        </Link>
      )}
      {akses.kelompokKartu.length > 0 && (
        <Link href="/absensi/kartu" className={buttonClass("kedua")}>
          <IdCard className="size-4" aria-hidden />
          Kartu QR
        </Link>
      )}
    </>
  );
}

async function DaftarSesi() {
  const akses = await getAksesAbsensi();
  if (!akses?.bolehLihat) return <AbsensiBelumMenyala />;

  const ids = akses.kelompokLihat.map((k) => k.id);
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const supabase = await createClient();
  const { data: sesi } = await supabase
    .from("sesi_absensi")
    .select(KOLOM_SESI)
    .or(`kelompok_id.is.null,kelompok_id.in.(${ids.join(",")})`)
    .order("mulai", { ascending: false })
    .limit(60)
    .returns<Sesi[]>();
  const daftar = sesi ?? [];

  const { data: catatan } = daftar.length
    ? await supabase
        .from("absensi")
        .select("sesi_id")
        .eq("status", "hadir")
        .in(
          "sesi_id",
          daftar.map((s) => s.id),
        )
        .returns<{ sesi_id: string }[]>()
    : { data: [] };
  const hadir = new Map<string, number>();
  for (const c of catatan ?? []) hadir.set(c.sesi_id, (hadir.get(c.sesi_id) ?? 0) + 1);

  const izinMenunggu = (await getPengajuanIzin({ menunggu: true })).filter((p) => p.bolehTangani).length;
  // Sesi yang sudah lewat jendela absensinya dianggap selesai.
  const masihDibuka = (s: Sesi) => !s.ditutup && jendelaScan(s) !== "lewat_waktu";
  const berjalan = daftar.filter(masihDibuka);
  const selesai = daftar.filter((s) => !masihDibuka(s));

  return (
    <div className="flex flex-col gap-6">
      <PertemuanHariIni />

      <Link
        href="/absensi/izin"
        className="flex items-center gap-3 rounded-card bg-surface p-5 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
      >
        <MailQuestion className={`size-5 shrink-0 ${izinMenunggu ? "text-warning" : "text-muted"}`} aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">Pengajuan izin dari generus</span>
          <span className="block text-muted">
            {izinMenunggu ? `${izinMenunggu} menunggu persetujuan` : "Tidak ada yang menunggu"}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>

      <p className="flex items-start gap-2 px-1 text-sm text-muted">
        <CalendarPlus className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Absensi terbuka otomatis untuk setiap pertemuan di Kegiatan, sesuai jendela kegiatannya (bawaan 30 menit
          sebelum mulai sampai 30 menit setelah selesai). Ada acara di luar jadwal?{" "}
          <Link href="/kegiatan/kelola" className="font-medium text-primary hover:underline">
            Buat agendanya di Kegiatan
          </Link>
          , absensinya ikut terbuka sendiri.
        </span>
      </p>

      {[
        { judul: "Sedang dibuka", isi: berjalan, kosong: "Belum ada absensi yang dibuka." },
        { judul: "Selesai", isi: selesai, kosong: "Belum ada absensi yang selesai." },
      ].map((bagian) => (
        <section key={bagian.judul} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">
            {bagian.judul} · {bagian.isi.length}
          </h2>
          {bagian.isi.length === 0 ? (
            <Card className="text-center text-sm text-muted">{bagian.kosong}</Card>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
              {bagian.isi.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/absensi/${s.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.nama}</span>
                        {s.hanya_generus && <Badge nada="utama">Generus</Badge>}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {tanggalJam(s.mulai)} ·{" "}
                        {s.kelompok_id ? (namaKelompok.get(s.kelompok_id) ?? "Kelompok") : "Seluruh desa"} ·{" "}
                        {hadir.get(s.id) ?? 0} hadir
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
