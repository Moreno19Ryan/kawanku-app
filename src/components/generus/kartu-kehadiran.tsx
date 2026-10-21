import { Flame, HandHeart, Medal, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Lencana, RingkasanKehadiran } from "@/lib/generus/kehadiran";

const IKON: Record<Lencana["ikon"], typeof Flame> = { api: Flame, medali: Medal, bintang: Star, janji: HandHeart };

/** Lingkaran persentase hadir bulan ini (SVG, mengikuti token warna). */
function Cincin({ persen }: { persen: number | null }) {
  const r = 34;
  const keliling = 2 * Math.PI * r;
  const isi = persen === null ? 0 : (persen / 100) * keliling;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-surface-muted" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${isi} ${keliling}`}
          className="stroke-primary transition-[stroke-dasharray] duration-700 ease-oneui"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{persen === null ? "–" : `${persen}%`}</span>
        <span className="text-[10px] text-muted">bulan ini</span>
      </span>
    </div>
  );
}

/** Ringkasan kehadiran generus sendiri: sapaan, persentase, rentetan, lencana. */
export function KartuKehadiran({ ringkasan }: { ringkasan: RingkasanKehadiran }) {
  const b = ringkasan.bulanIni;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Cincin persen={b.persen} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{ringkasan.sapaan}</p>
          <p className="mt-1 text-sm text-muted">
            {b.total === 0
              ? "Belum ada pertemuan bulan ini."
              : `${b.hadir} hadir dari ${b.total} pertemuan${b.izin + b.sakit ? ` · ${b.izin + b.sakit} izin/sakit` : ""}${
                  b.alpa ? ` · ${b.alpa} terlewat` : ""
                }`}
          </p>
        </div>
      </div>
      {ringkasan.lencana.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Lencana">
          {ringkasan.lencana.map((l) => {
            const Icon = IKON[l.ikon];
            return (
              <li
                key={l.kode}
                title={l.keterangan}
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
              >
                <Icon className="size-3.5" aria-hidden />
                {l.judul}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
