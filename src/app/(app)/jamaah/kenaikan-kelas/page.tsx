import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { FormKenaikan } from "@/components/jamaah/form-kenaikan";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { KembaliKeJamaah } from "@/components/jamaah/kembali";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { labelTahunAjaran, tahunAjaran } from "@/lib/jamaah/kenaikan";
import { terapkanKenaikanKelas } from "@/lib/jamaah/kenaikan-actions";
import { getCalonKenaikan, getCatatanKenaikan } from "@/lib/jamaah/kenaikan-data";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Kenaikan kelas",
};

export default function KenaikanKelasPage({ searchParams }: PageProps<"/jamaah/kenaikan-kelas">) {
  return (
    <>
      <KembaliKeJamaah />
      <PageHeader
        title="Kenaikan kelas"
        description="Naikkan kelas jamaah bersekolah sekaligus tiap tahun ajaran baru; kategori ikut menyesuaikan."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Isi cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [akses, mentah] = await Promise.all([getAksesJamaah(), cari]);
  if (!akses || akses.kelompokLihat.length === 0) return <JamaahBelumMenyala />;
  if (akses.kelompokUbah.length === 0) {
    return <Card className="text-sm text-muted">Kenaikan kelas dikerjakan admin yang boleh mengubah data jamaah.</Card>;
  }

  const diminta = typeof mentah.kelompok === "string" ? mentah.kelompok : "";
  const kelompok = akses.kelompokUbah.find((k) => k.id === diminta) ?? akses.kelompokUbah[0];
  const [calon, catatan] = await Promise.all([
    getCalonKenaikan(kelompok.id),
    getCatatanKenaikan(akses.kelompokUbah.map((k) => k.id)),
  ]);
  const sudah = catatan.get(kelompok.id);
  const tanpaKelas = calon.filter((c) => c.kelas === null).length;

  return (
    <div className="flex flex-col gap-5">
      {akses.kelompokUbah.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Pilih kelompok">
          {akses.kelompokUbah.map((k) => {
            const aktif = k.id === kelompok.id;
            return (
              <Link
                key={k.id}
                href={`?kelompok=${k.id}`}
                aria-current={aktif ? "page" : undefined}
                className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
                  aktif ? "bg-primary text-primary-fg" : "bg-surface-muted text-muted hover:text-fg"
                }`}
              >
                {k.nama}
                {catatan.has(k.id) && " ✓"}
              </Link>
            );
          })}
        </nav>
      )}

      {sudah && (
        <div className="flex items-start gap-3 rounded-card bg-success/10 p-5 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p>
            {sudah.jumlah} jamaah {kelompok.nama} sudah diperbarui tahun ajaran ini, terakhir oleh {sudah.oleh} (
            {tanggalJam(sudah.pada)}).
          </p>
        </div>
      )}

      <Card>
        <h2 className="font-semibold">Tahun ajaran {labelTahunAjaran(tahunAjaran())}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          <li>Usulan otomatis: naik satu kelas; kelas 6 → SMP kelas 7; kelas 9 → SMA/SMK kelas 10.</li>
          <li>Kelas 12 → pilih lulus ke kuliah, bekerja, atau lainnya. Pilih &ldquo;Tetap&rdquo; bila tinggal kelas.</li>
          <li>Kelas belum diisi → pilih kelasnya sekarang (tidak dinaikkan).</li>
          <li>Setiap jamaah hanya naik sekali per tahun ajaran; yang sudah diperbarui hilang dari daftar.</li>
          <li>PAUD/TK → SD diubah manual di data jamaah (umur masuk SD berbeda-beda).</li>
        </ul>
      </Card>

      {calon.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          Semua jamaah bersekolah di {kelompok.nama} sudah sesuai tahun ajaran {labelTahunAjaran(tahunAjaran())}.
          Alhamdulillah.
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold">
            {calon.length} jamaah {kelompok.nama}
          </h2>
          {tanpaKelas > 0 && (
            <p className="mt-1 text-sm text-muted">{tanpaKelas} belum diisi kelasnya: lengkapi sekalian di sini.</p>
          )}
          <div className="mt-3">
            <FormKenaikan key={kelompok.id} aksi={terapkanKenaikanKelas.bind(null, kelompok.id)} baris={calon} />
          </div>
        </Card>
      )}
    </div>
  );
}
