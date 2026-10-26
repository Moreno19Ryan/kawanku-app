import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { FormPengajar } from "@/components/kegiatan/form-pengajar";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Memuat } from "@/components/ui/memuat";
import { aturPengajarAktif, hapusPengajar } from "@/lib/kegiatan/actions";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { createClient } from "@/lib/supabase/server";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { INPUT_CLASS } from "@/components/ui/input";
import { bulanWib, daftarBulan, namaBulan } from "@/lib/absensi/laporan-hitung";
import { getRekapPengajar } from "@/lib/kegiatan/rekap-pengajar";

export const metadata: Metadata = {
  title: "Pengajar",
};

type Pengajar = { id: string; nama: string; keterangan: string | null; kelompok_id: string | null; aktif: boolean };

export default function PengajarPage({ searchParams }: PageProps<"/kegiatan/pengajar">) {
  return (
    <>
      <Link href="/kegiatan" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Kegiatan
      </Link>
      <PageHeader
        title="Pengajar rutin"
        description="Daftar pengajar yang bisa dipilih sebagai pemateri di setiap pertemuan. Pemateri tetap diisi per pertemuan."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <Isi />
      </Suspense>
      <Suspense fallback={<Memuat className="h-64" />}>
        <RekapBulanan cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Isi() {
  const akses = await getAksesKegiatan();
  if (!akses || akses.kelompokLihat.length === 0) return <KegiatanBelumMenyala />;
  const wilayah = [
    ...(akses.kelolaDesa ? [{ nilai: "desa", nama: "Seluruh desa" }] : []),
    ...akses.kelompokKelola.map((k) => ({ nilai: k.id, nama: k.nama })),
  ];
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const supabase = await createClient();
  // RLS: pengajar desa + kelompok yang boleh dilihat.
  const { data } = await supabase
    .from("pengajar")
    .select("id, nama, keterangan, kelompok_id, aktif")
    .order("aktif", { ascending: false })
    .order("nama")
    .returns<Pengajar[]>();
  const bolehUbah = (p: Pengajar) =>
    p.kelompok_id === null ? akses.kelolaDesa : akses.kelompokKelola.some((k) => k.id === p.kelompok_id);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {wilayah.length > 0 && (
        <Card>
          <h2 className="mb-5 text-lg font-semibold">Tambah pengajar</h2>
          <FormPengajar wilayah={wilayah} />
        </Card>
      )}
      {(data ?? []).length === 0 ? (
        <Card className="text-center text-sm text-muted">Belum ada pengajar rutin.</Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {(data ?? []).map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${p.aktif ? "" : "text-muted"}`}>{p.nama}</span>
                  <Badge>{p.kelompok_id ? (namaKelompok.get(p.kelompok_id) ?? "Kelompok") : "Seluruh desa"}</Badge>
                  {!p.aktif && <Badge>Nonaktif</Badge>}
                </div>
                {p.keterangan && <p className="text-sm text-muted">{p.keterangan}</p>}
              </div>
              {bolehUbah(p) && (
                <div className="flex gap-2">
                  <TombolAksi
                    aksi={aturPengajarAktif.bind(null, p.id, !p.aktif)}
                    label={p.aktif ? "Nonaktifkan" : "Aktifkan"}
                    varian={p.aktif ? "netral" : "kedua"}
                  />
                  <TombolAksi
                    aksi={hapusPengajar.bind(null, p.id)}
                    label="Hapus"
                    varian="bahaya"
                    konfirmasi={`Hapus ${p.nama} dari daftar? Pertemuan yang sudah diisi tetap menyimpan namanya.`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs text-muted">
        Muballigh/ot yang tercatat di data jamaah otomatis ikut bisa dipilih. Pengajar nonaktif tidak muncul di pilihan
        pemateri.
      </p>
    </div>
  );
}

/** Rekap pemateri per bulan: siapa mengisi, berapa sesi, di kegiatan & wilayah mana, materi terakhir. */
async function RekapBulanan({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const akses = await getAksesKegiatan();
  if (!akses || akses.kelompokLihat.length === 0) return null;
  const pilihan = daftarBulan(12).reverse();
  const minta = (await cari).bulan;
  const bulan = typeof minta === "string" && pilihan.includes(minta) ? minta : bulanWib(new Date().toISOString());
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const rekap = await getRekapPengajar(bulan, namaKelompok);

  return (
    <section aria-labelledby="rekap-pengajar" className="mt-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="rekap-pengajar" className="text-lg font-semibold">
            Rekap pengajar
          </h2>
          <p className="text-sm text-muted">Dari pemateri yang diisi di setiap pertemuan (libur tidak dihitung).</p>
        </div>
        <FormOtomatis>
          <select name="bulan" defaultValue={bulan} aria-label="Bulan" className={INPUT_CLASS}>
            {pilihan.map((b) => (
              <option key={b} value={b}>
                {namaBulan(b)}
              </option>
            ))}
          </select>
        </FormOtomatis>
      </div>
      {rekap.length === 0 ? (
        <Card className="text-center text-sm text-muted">Belum ada pemateri tercatat di {namaBulan(bulan)}.</Card>
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Pemateri</th>
                <th className="px-3 py-3 text-right font-medium">Sesi</th>
                <th className="px-3 py-3 font-medium">Kegiatan</th>
                <th className="px-3 py-3 font-medium">Wilayah</th>
                <th className="px-5 py-3 font-medium">Materi terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rekap.map((r) => (
                <tr key={r.nama}>
                  <td className="px-5 py-3 font-medium">{r.nama}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.sesi}
                    {r.pertemuan !== r.sesi && <span className="block text-xs text-muted">{r.pertemuan} pertemuan</span>}
                  </td>
                  <td className="px-3 py-3">{r.kegiatan.join(", ")}</td>
                  <td className="px-3 py-3">{r.wilayah.join(", ")}</td>
                  <td className="px-5 py-3 text-muted">{r.materi.join(" · ") || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
