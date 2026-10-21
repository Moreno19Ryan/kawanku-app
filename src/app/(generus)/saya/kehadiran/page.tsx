import type { Metadata } from "next";
import { Suspense } from "react";
import { KartuKehadiran } from "@/components/generus/kartu-kehadiran";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKehadiranSaya } from "@/lib/generus/data";
import { bulanWib, labelKehadiran, ringkasKehadiran, type CatatanKehadiran } from "@/lib/generus/kehadiran";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Kehadiran",
};

const judulBulan = (bulan: string) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${bulan}-01T00:00:00Z`),
  );

export default function KehadiranPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
      <Kehadiran />
    </Suspense>
  );
}

async function Kehadiran() {
  await wajibGenerus();
  const catatan = await getKehadiranSaya(240);
  const ringkasan = ringkasKehadiran(catatan);
  const perBulan = new Map<string, CatatanKehadiran[]>();
  for (const c of catatan) {
    const b = bulanWib(c.mulai);
    perBulan.set(b, [...(perBulan.get(b) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kehadiran</h1>
        <p className="text-sm text-muted">Hanya kamu yang melihat catatan ini.</p>
      </div>
      <KartuKehadiran ringkasan={ringkasan} />
      <p className="px-1 text-sm text-muted">
        Total {ringkasan.totalHadir} kali hadir{ringkasan.rentetan > 0 ? ` · ${ringkasan.rentetan}× beruntun saat ini` : ""}.
      </p>

      {catatan.length === 0 ? (
        <Card className="text-center text-sm text-muted">Belum ada catatan kehadiran.</Card>
      ) : (
        [...perBulan.entries()].map(([bulan, isi]) => {
          const hadir = isi.filter((c) => c.status === "hadir").length;
          const dinilai = isi.filter((c) => c.status !== "berjalan").length;
          return (
            <section key={bulan} className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-semibold text-muted">
                {judulBulan(bulan)} · {hadir}/{dinilai} hadir
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
                {isi.map((c) => {
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
          );
        })
      )}
    </div>
  );
}
