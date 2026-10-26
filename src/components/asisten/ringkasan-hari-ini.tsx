import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardCheck, Sunrise, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type Ringkasan = { pertemuan: number; tanpa_pemateri: number; izin: number };

/**
 * Ringkasan hari ini untuk admin (RPC ringkasan_hari_ini: aturan izin sama
 * dengan RLS; isi yang sama dikirim ke HP admin tiap pagi). Membaca sesi →
 * harus di dalam <Suspense>.
 */
export async function RingkasanHariIni({ className = "" }: { className?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ringkasan_hari_ini");
  const r = data as Ringkasan | null;
  if (!r) return null;

  const baris = [
    r.pertemuan > 0 && { ikon: CalendarDays, teks: `${r.pertemuan} pertemuan hari ini`, href: "/kegiatan" },
    r.izin > 0 && { ikon: ClipboardCheck, teks: `${r.izin} izin menunggu persetujuan`, href: "/absensi/izin" },
    r.tanpa_pemateri > 0 && {
      ikon: UserRound,
      teks: `${r.tanpa_pemateri} pertemuan hari ini/besok belum ada pemateri`,
      href: "/kegiatan",
    },
  ].filter((b) => !!b);

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Sunrise className="size-5 text-primary" aria-hidden />
        Ringkasan hari ini
      </h2>
      {baris.length === 0 ? (
        <p className="text-sm text-muted">Alhamdulillah, tidak ada yang perlu ditindaklanjuti hari ini.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {baris.map((b) => {
            const isi = (
              <>
                <b.ikon className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">{b.teks}</span>
                {b.href && <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
              </>
            );
            return (
              <li key={b.teks}>
                {b.href ? (
                  <Link
                    href={b.href}
                    className="flex items-center gap-3 rounded-control px-2 py-2 text-sm transition-colors duration-200 ease-oneui hover:bg-surface-muted"
                  >
                    {isi}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2 text-sm">{isi}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
