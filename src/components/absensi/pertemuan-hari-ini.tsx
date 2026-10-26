import Link from "next/link";
import { CalendarClock, ChevronRight, UserRound } from "lucide-react";
import { hrefPertemuan } from "@/components/kegiatan/daftar-kejadian";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { getAksesAbsensi, jamAbsensi, jendelaScan } from "@/lib/absensi/akses";
import { siapkanAbsensiOtomatis } from "@/lib/absensi/otomatis";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib } from "@/lib/kegiatan/jadwal";
import { jam } from "@/lib/waktu";

/**
 * Pertemuan hari ini beserta absensinya. Absensi terbuka & tertutup otomatis
 * sesuai jendela kegiatannya (dibuka database tiap menit lewat pg_cron;
 * siapkanAbsensiOtomatis sebagai cadangan saat halaman ini dibuka). Dipakai di Beranda admin & halaman
 * Absensi. Tidak tampil bila tidak ada pertemuan hari ini atau modul
 * Kegiatan tidak tersedia.
 */
export async function PertemuanHariIni({
  judul = "Pertemuan hari ini",
  className = "",
}: {
  judul?: string;
  className?: string;
}) {
  const [akses, aksesAbsensi] = await Promise.all([getAksesKegiatan(), getAksesAbsensi()]);
  if (!akses || akses.kelompokLihat.length === 0) return null;
  const hariIni = hariIniWib();
  const kejadian = await siapkanAbsensiOtomatis(
    (await getKalender(hariIni, hariIni, akses.kelompokLihat.map((k) => k.id))).filter((k) => k.status === "terjadwal"),
    aksesAbsensi,
  );
  if (kejadian.length === 0) return null;
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));

  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        {judul}
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
        {kejadian.map((k) => {
          const waktu = jamAbsensi(k);
          const jendela = jendelaScan(k);
          return (
            <li key={k.kunci} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <Link href={hrefPertemuan(k)} className="group flex min-w-0 flex-1 items-center gap-4">
                <span className="w-14 shrink-0 text-center text-lg font-semibold">{jam(k.mulai)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium group-hover:text-primary">{k.kegiatan.nama}</span>
                    {k.kelompokId && <Badge>{namaKelompok.get(k.kelompokId) ?? "Kelompok"}</Badge>}
                    {k.kegiatan.hanya_generus && <Badge nada="utama">Generus</Badge>}
                    {k.sesiId && <Badge nada="sukses">Absensi dibuka</Badge>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                    <UserRound className="size-3.5" aria-hidden />
                    {k.pemateri ?? "Pemateri belum diisi"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Absensi otomatis {jam(waktu.buka)}–{jam(waktu.tutup)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted sm:hidden" aria-hidden />
              </Link>
              {k.sesiId ? (
                <Link href={`/absensi/${k.sesiId}`} className={buttonClass("utama", "h-9 px-4")}>
                  {jendela === "lewat_waktu" ? "Lihat absensi" : "Buka absensi"}
                </Link>
              ) : jendela === "belum_waktunya" ? (
                <span className="text-sm text-muted">Terbuka otomatis {jam(waktu.buka)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
