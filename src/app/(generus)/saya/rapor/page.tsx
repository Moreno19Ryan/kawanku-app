import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Flame, HandHeart, Medal, Star, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Memuat } from "@/components/ui/memuat";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKehadiranSaya } from "@/lib/generus/data";
import { bulanLalu, bulanWib, labelKehadiran, raporBulan, type Lencana } from "@/lib/generus/kehadiran";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Rapor kehadiran",
};

const IKON: Record<Lencana["ikon"], typeof Flame> = { api: Flame, medali: Medal, bintang: Star, janji: HandHeart };

export default function RaporPage({ searchParams }: PageProps<"/saya/rapor">) {
  return (
    <Suspense fallback={<Memuat className="mt-8 h-96" />}>
      <Rapor cari={searchParams} />
    </Suspense>
  );
}

async function Rapor({ cari }: { cari: PageProps<"/saya/rapor">["searchParams"] }) {
  await wajibGenerus();
  const param = await cari;
  const minta = typeof param.bulan === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(param.bulan) ? param.bulan : null;
  const catatan = await getKehadiranSaya(240);

  // Bulan yang punya catatan (terbaru dulu), ditambah bulan lalu sebagai bawaan.
  const ini = bulanWib(new Date().toISOString());
  const tersedia = [...new Set([bulanLalu(), ...catatan.map((c) => bulanWib(c.mulai))])]
    .filter((b) => b <= ini)
    .sort()
    .reverse();
  const bulan = minta && tersedia.includes(minta) ? minta : bulanLalu();
  const r = raporBulan(catatan, bulan);
  const i = tersedia.indexOf(bulan);
  const lebihLama = tersedia[i + 1];
  const lebihBaru = i > 0 ? tersedia[i - 1] : undefined;

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex items-center justify-between gap-3">
        {lebihLama ? (
          <Link href={`/saya/rapor?bulan=${lebihLama}`} aria-label="Bulan sebelumnya" className="rounded-pill p-2 text-primary hover:bg-surface-muted">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-9" />
        )}
        <div className="text-center">
          <p className="text-sm text-muted">Rapor kehadiran</p>
          <h1 className="text-2xl font-semibold tracking-tight">{r.judul}</h1>
        </div>
        {lebihBaru ? (
          <Link href={`/saya/rapor?bulan=${lebihBaru}`} aria-label="Bulan berikutnya" className="rounded-pill p-2 text-primary hover:bg-surface-muted">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-9" />
        )}
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">{r.persen === null ? "–" : `${r.persen}%`}</p>
            <p className="text-sm text-muted">
              {r.total === 0 ? "Belum ada pertemuan" : `Hadir ${r.hadir} dari ${r.total} pertemuan`}
            </p>
          </div>
          {r.selisih !== null && r.selisih !== 0 && (
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${r.selisih > 0 ? "text-success" : "text-muted"}`}>
              {r.selisih > 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
              {r.selisih > 0 ? "+" : ""}
              {r.selisih} poin dari bulan sebelumnya
            </span>
          )}
        </div>
        {r.total > 0 && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Hadir", r.hadir],
              ["Izin/sakit", r.izin + r.sakit],
              ["Terlewat", r.alpa],
            ].map(([label, nilai]) => (
              <div key={label} className="rounded-control bg-surface-muted px-2 py-3">
                <dd className="text-xl font-semibold tabular-nums">{nilai}</dd>
                <dt className="text-xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        )}
        <p className="font-medium">{r.pesan}</p>
        {r.lencana.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Lencana bulan ini">
            {r.lencana.map((l) => {
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

      {r.catatan.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">Pertemuan {r.judul}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {[...r.catatan].reverse().map((c) => {
              const l = labelKehadiran(c);
              return (
                <li key={c.sesi_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.nama}</span>
                    <span className="block text-sm text-muted">{tanggalJam(c.mulai)}</span>
                  </span>
                  <Badge nada={l.nada}>{l.label}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="px-1 text-center text-xs text-muted">Hanya kamu yang melihat rapor ini.</p>
    </div>
  );
}
