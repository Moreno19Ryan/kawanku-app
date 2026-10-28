import Link from "next/link";
import { CalendarClock, ChevronRight, UserRound } from "lucide-react";
import { hrefPertemuan } from "@/components/kegiatan/daftar-kejadian";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAksesAbsensi, jamAbsensi, jendelaScan } from "@/lib/absensi/akses";
import { siapkanAbsensiOtomatis } from "@/lib/absensi/otomatis";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib } from "@/lib/kegiatan/jadwal";
import { createClient } from "@/lib/supabase/server";
import { jam } from "@/lib/waktu";

/**
 * Kartu "Hari ini" yang mengambang di tepi panel sambutan Beranda admin:
 * pertemuan terdekat hari ini (yang berlangsung, berikutnya, atau terakhir)
 * dengan jumlah hadir dan tombol absensinya; pertemuan lain hari ini di
 * bawahnya. Tanpa pertemuan: tautan ke jadwal. Membaca sesi → di dalam
 * <Suspense>. Absensi dibuka otomatis (pg_cron; siapkanAbsensiOtomatis cadangan).
 */
export async function KartuHariIni({ className = "" }: { className?: string }) {
  const [akses, aksesAbsensi] = await Promise.all([getAksesKegiatan(), getAksesAbsensi()]);
  const hariIni = hariIniWib();
  const kejadian =
    akses && akses.kelompokLihat.length > 0
      ? await siapkanAbsensiOtomatis(
          (await getKalender(hariIni, hariIni, akses.kelompokLihat.map((k) => k.id))).filter(
            (k) => k.status === "terjadwal",
          ),
          aksesAbsensi,
        )
      : [];

  if (kejadian.length === 0) {
    return (
      <Card className={`flex items-center gap-4 ${className}`}>
        <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">Tidak ada pertemuan hari ini</span>
          <span className="block text-muted">Jadwal pekan ini ada di Kegiatan.</span>
        </p>
        {akses && akses.kelompokLihat.length > 0 && (
          <Link href="/kegiatan" className={buttonClass("kedua", "h-10 px-4")}>
            Lihat jadwal
          </Link>
        )}
      </Card>
    );
  }

  const sekarang = new Date().toISOString();
  const utama =
    kejadian.find((k) => k.mulai <= sekarang && k.selesai > sekarang) ??
    kejadian.find((k) => k.mulai > sekarang) ??
    kejadian[kejadian.length - 1];
  const lain = kejadian.filter((k) => k !== utama);
  const waktu = jamAbsensi(utama);
  const jendela = jendelaScan(utama);
  const namaKelompok = new Map((akses?.kelompokFitur ?? []).map((k) => [k.id, k.nama]));

  let hadir: number | null = null;
  if (utama.sesiId) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("absensi")
      .select("jamaah_id", { count: "exact", head: true })
      .eq("sesi_id", utama.sesiId)
      .eq("status", "hadir");
    hadir = count ?? null;
  }

  const keterangan =
    jendela === "belum_waktunya"
      ? `Absensi terbuka ${jam(waktu.buka)}`
      : jendela === "lewat_waktu"
        ? "Absensi sudah ditutup"
        : `Absensi terbuka sampai ${jam(waktu.tutup)}`;

  return (
    <Card className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarClock className="size-4" aria-hidden />
            Hari ini · {keterangan}
          </p>
          <Link href={hrefPertemuan(utama)} className="group">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold group-hover:text-primary">{utama.kegiatan.nama}</span>
              {utama.kegiatan.hanya_generus && <Badge nada="utama">Generus</Badge>}
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {[`${jam(utama.mulai)} WIB`, utama.kelompokId ? namaKelompok.get(utama.kelompokId) : "Tingkat desa"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
          <p className="flex items-center gap-1.5 text-sm">
            <UserRound className="size-4 text-muted" aria-hidden />
            {utama.pemateri ?? "Pemateri belum diisi"}
          </p>
          {hadir !== null && (
            <p className="text-sm">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{hadir.toLocaleString("id-ID")}</span>{" "}
              <span className="text-muted">hadir tercatat</span>
            </p>
          )}
        </div>
        {utama.sesiId && (
          <div className="flex flex-col gap-2 lg:w-52">
            <Link href={`/absensi/${utama.sesiId}`} className={buttonClass("utama", "h-12")}>
              {jendela === "lewat_waktu" ? "Lihat absensi" : "Buka absensi"}
            </Link>
            {jendela !== "lewat_waktu" && (
              // buttonClass memakai inline-flex, jadi sembunyikan lewat pembungkus.
              <div className="hidden lg:block">
                <Link href={`/layar/${utama.sesiId}`} target="_blank" className={buttonClass("kedua", "w-full")}>
                  Tampilkan QR layar
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {lain.length > 0 && (
        <ul className="-mx-2 flex flex-col border-t border-border pt-2">
          {lain.map((k) => (
            <li key={k.kunci}>
              <Link
                href={k.sesiId ? `/absensi/${k.sesiId}` : hrefPertemuan(k)}
                className="flex items-center gap-3 rounded-control px-2 py-2 text-sm transition-colors duration-200 ease-oneui hover:bg-surface-muted"
              >
                <span className="w-12 shrink-0 font-semibold tabular-nums">{jam(k.mulai)}</span>
                <span className="min-w-0 flex-1 truncate">{k.kegiatan.nama}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
