import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Beranda",
};

const PLACEHOLDER_STATS = [
  { label: "Jamaah terdata", hint: "Fase 1" },
  { label: "Kelompok", hint: "Fase 1" },
  { label: "Kehadiran minggu ini", hint: "Fase 2" },
  { label: "Kegiatan aktif", hint: "Fase 3" },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Beranda"
        description="Ringkasan Desa Kartika Wanasari akan tampil di sini."
      />

      <section
        aria-label="Ringkasan"
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        {PLACEHOLDER_STATS.map((stat) => (
          <Card key={stat.label} className="flex flex-col gap-2">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="text-3xl font-semibold text-muted/40">–</p>
            <p className="text-xs text-muted">Tersedia di {stat.hint}</p>
          </Card>
        ))}
      </section>

      <Card className="mt-4 sm:mt-6">
        <h2 className="text-lg font-semibold">Fondasi siap</h2>
        <p className="mt-1 text-sm text-muted">
          Ini kerangka Fase 0. Data jamaah, absensi, dan kegiatan belum
          tersambung.
        </p>
      </Card>
    </>
  );
}
