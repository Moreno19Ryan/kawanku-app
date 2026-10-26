import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { GrafikTren } from "@/components/absensi/grafik-tren";
import { DaftarBatang, FilterLaporan, TabelJamaah, Ubin } from "@/components/absensi/laporan-bagian";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { namaBulan, type StatusJamaah } from "@/lib/absensi/laporan-hitung";
import { bacaParamLaporan, getLaporan, queryLaporan } from "@/lib/absensi/laporan";
import { FormSapaan } from "@/components/absensi/form-sapaan";
import { catatSapaan } from "@/lib/absensi/actions";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import { getSapaanTerakhir, LABEL_HASIL_SAPAAN } from "@/lib/absensi/sapaan";
import { tanggalJam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Laporan kehadiran",
};

// Token mentah (--kk-*): --color-* yang tidak dipakai kelas utilitas tidak dikeluarkan Tailwind.
const WARNA_SERI = ["var(--kk-grafik-1)", "var(--kk-grafik-2)", "var(--kk-grafik-3)", "var(--kk-grafik-4)"];

export default function LaporanPage({ searchParams }: PageProps<"/absensi/laporan">) {
  return (
    <>
      <Link href="/absensi" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <PageHeader
        title="Laporan kehadiran"
        description="Tren beberapa bulan, perbandingan kelompok & kegiatan, dan siapa yang perlu disapa."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <Isi cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const hasil = await getLaporan(bacaParamLaporan(await cari));
  if (!hasil) return <AbsensiBelumMenyala />;
  const { param, laporan: l, wilayah, namaWilayah } = hasil;

  const label = l.bulan.map((b) => namaBulan(b, true));
  // Lebih dari 4 kelompok → hanya total (warna kategori tidak diulang).
  const seri =
    l.seri.length > 1 && l.seri.length <= WARNA_SERI.length
      ? l.seri.map((s, i) => ({ nama: s.nama, warna: WARNA_SERI[i], nilai: s.titik.map((t) => t.persen) }))
      : [{ nama: "Kehadiran", warna: "var(--kk-primary)", nilai: l.tren.map((t) => t.persen) }];
  const hitung = l.jamaah.reduce(
    (m, b) => ({ ...m, [b.status]: m[b.status] + 1 }),
    { semua: l.jamaah.length, perlu_disapa: 0, menurun: 0, jarang: 0, rajin: 0, biasa: 0 } as Record<StatusJamaah | "semua", number>,
  );
  const peserta = param.peserta === "generus" ? "generus" : "jamaah";

  return (
    <div className="flex flex-col gap-5">
      <FilterLaporan param={param} wilayah={wilayah} />

      <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
        <FileText className="size-4 text-muted" aria-hidden />
        <span className="text-muted">Laporan bulanan siap cetak:</span>
        {l.bulan
          .slice(-2)
          .reverse()
          .map((b) => (
            <a
              key={b}
              href={`/cetak/laporan?${new URLSearchParams({ wilayah: param.wilayah, peserta: param.peserta, bulan: b })}`}
              target="_blank"
              rel="noopener"
              className="font-medium text-primary hover:underline"
            >
              {namaBulan(b)}
            </a>
          ))}
      </div>

      <section className="rounded-card bg-primary-soft p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <Sparkles className="size-4" aria-hidden />
          Sorotan · {namaWilayah}
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {l.sorotan.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ubin
          judul="Rata-rata kehadiran"
          nilai={l.ringkas.persen === null ? "–" : `${l.ringkas.persen}%`}
          keterangan={`${l.ringkas.kehadiran} dari ${l.ringkas.kesempatan} kesempatan`}
        />
        <Ubin judul="Pertemuan" nilai={String(l.ringkas.pertemuan)} keterangan={`${param.rentang} bulan terakhir`} />
        <Ubin judul="Perlu disapa" nilai={String(l.ringkas.perluDisapa)} keterangan="3 pertemuan terakhir tidak hadir" />
        <Ubin judul="Rajin" nilai={String(l.ringkas.rajin)} keterangan={`dari ${l.ringkas.dipantau} ${peserta} dipantau`} />
      </div>

      <Card>
        <h2 className="font-semibold">Tren kehadiran per bulan</h2>
        <p className="mb-4 text-sm text-muted">
          {seri.length > 1 ? "Per kelompok. " : ""}Sentuh atau arahkan kursor untuk melihat angkanya.
        </p>
        <GrafikTren label={label} seri={seri} judul={`Tren kehadiran ${namaWilayah}`} />
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Lihat sebagai tabel</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Bulan</th>
                  <th className="px-3 py-2 text-right font-medium">Pertemuan</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  {l.seri.length > 1 &&
                    l.seri.map((s) => (
                      <th key={s.id} className="px-3 py-2 text-right font-medium">
                        {s.nama}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {l.tren.map((t, i) => (
                  <tr key={t.bulan} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{namaBulan(t.bulan)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.pertemuan}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.persen === null ? "–" : `${t.persen}%`}</td>
                    {l.seri.length > 1 &&
                      l.seri.map((s) => (
                        <td key={s.id} className="px-3 py-2 text-right tabular-nums">
                          {s.titik[i].persen === null ? "–" : `${s.titik[i].persen}%`}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Per kegiatan</h2>
          <DaftarBatang
            isi={l.perKegiatan.map((k) => ({ nama: k.nama, persen: k.persen, keterangan: `${k.pertemuan} pertemuan` }))}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Per kategori jamaah</h2>
          <DaftarBatang isi={l.perKategori.map((k) => ({ nama: k.nama, persen: k.persen, keterangan: `${k.jumlah} orang` }))} />
        </Card>
      </div>

      <TindakLanjut baris={l.jamaah.filter((b) => b.status === "perlu_disapa")} />

      <Card>
        <h2 className="font-semibold">Pemantauan {peserta}</h2>
        <p className="mb-4 text-sm text-muted">
          Perlu disapa = tidak hadir 3 pertemuan terakhir yang diikutinya. Menurun = kehadiran paruh akhir turun ≥25 poin.
          Rajin = hadir ≥85% (minimal 4 pertemuan). Izin & sakit dihitung bukan hadir, tapi tidak memicu &ldquo;perlu disapa&rdquo;.
        </p>
        <TabelJamaah baris={l.jamaah} hitung={hitung} param={param} tautan={(status) => `?${queryLaporan(param, { status })}`} />
      </Card>
    </div>
  );
}

/** Jamaah perlu disapa beserta catatan sapaan terakhirnya; pengelola absensi bisa mencatat sapaan. */
async function TindakLanjut({ baris }: { baris: { id: string; nama: string; kode: string; kelompok: string; terakhirHadir: string | null }[] }) {
  if (!baris.length) return null;
  const [sapaan, akses] = await Promise.all([getSapaanTerakhir(baris.map((b) => b.id)), getAksesAbsensi()]);
  const bolehCatat = Boolean(akses?.kelompokKelola.length);
  const sudah = baris.filter((b) => sapaan.has(b.id)).length;
  return (
    <Card>
      <h2 className="font-semibold">Tindak lanjut: perlu disapa</h2>
      <p className="mb-4 text-sm text-muted">
        {baris.length} jamaah tidak hadir 3 pertemuan terakhir; {sudah} sudah pernah disapa. Sapaan hangat dari pengurus
        sering kali cukup untuk mengajak kembali hadir.
      </p>
      <ul className="divide-y divide-border">
        {baris.map((b) => {
          const s = sapaan.get(b.id);
          return (
            <li key={b.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {b.nama} <span className="font-normal text-muted">· {b.kelompok}</span>
                </span>
                <span className="text-muted">
                  {b.terakhirHadir ? `Terakhir hadir ${tanggalJam(b.terakhirHadir)}` : "Belum pernah hadir di rentang ini"}
                </span>
              </div>
              {s ? (
                <p className="text-sm">
                  <span className="font-medium">{LABEL_HASIL_SAPAAN[s.hasil]}</span>
                  <span className="text-muted">
                    {" "}
                    · {tanggalJam(s.created_at)}
                    {s.oleh ? ` oleh ${s.oleh}` : ""}
                  </span>
                  {s.catatan ? <span className="block text-muted">&ldquo;{s.catatan}&rdquo;</span> : null}
                </p>
              ) : (
                <p className="text-sm text-muted">Belum ada catatan sapaan.</p>
              )}
              {bolehCatat && <FormSapaan aksi={catatSapaan.bind(null, b.id)} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
