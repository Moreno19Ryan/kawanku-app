import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { FormBatalPertemuan, FormPertemuan } from "@/components/kegiatan/form-pertemuan";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DaftarPengajuan } from "@/components/absensi/daftar-pengajuan";
import { belumBisaDibuka, bolehBukaAbsensi, getAksesAbsensi } from "@/lib/absensi/akses";
import { getPengajuanIzin } from "@/lib/absensi/izin";
import { bolehKelolaPertemuan, getAksesKegiatan } from "@/lib/kegiatan/akses";
import { aktifkanPertemuan, batalkanPertemuan, bukaAbsensiPertemuan, simpanPertemuan } from "@/lib/kegiatan/actions";
import { getKalender } from "@/lib/kegiatan/data";
import { kunciKejadian } from "@/lib/kegiatan/jadwal";
import { labelJenisMuballigh } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { keInputWib, tanggalJam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Pertemuan",
};

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function PertemuanPage({ searchParams }: PageProps<"/kegiatan/pertemuan">) {
  return (
    <>
      <Link href="/kegiatan" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Kegiatan
      </Link>
      <Suspense fallback={<Memuat className="mt-6 h-96" />}>
        <Detail cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Detail({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [akses, aksesAbsensi, param] = await Promise.all([getAksesKegiatan(), getAksesAbsensi(), cari]);
  if (!akses || akses.kelompokLihat.length === 0) return <KegiatanBelumMenyala />;
  const kegiatanId = satu(param.k);
  const kel = satu(param.kel);
  const tanggal = satu(param.t);
  if (!/^[0-9a-f-]{36}$/.test(kegiatanId) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) notFound();
  const kelompokId = kel === "desa" ? null : kel;

  const kalender = await getKalender(
    tanggal,
    tanggal,
    kelompokId ? [kelompokId] : akses.kelompokLihat.map((k) => k.id),
  );
  const k = kalender.find((x) => x.kunci === kunciKejadian(kegiatanId, kelompokId, tanggal));
  if (!k) notFound();

  const supabase = await createClient();
  const kelola = bolehKelolaPertemuan(akses, k.kelompokId, k.kegiatan.hanya_generus);
  const [{ data: muballigh }, ringkas, pengajuan] = await Promise.all([
    kelola
      ? supabase
          .from("jamaah")
          .select("id, nama_lengkap, jenis_kelamin, jenis_muballigh, kelompok:kelompok_id(nama)")
          .eq("muballigh", true)
          .eq("aktif", true)
          .order("nama_lengkap")
          .returns<{ id: string; nama_lengkap: string; jenis_kelamin: string; jenis_muballigh: string | null; kelompok: { nama: string } | null }[]>()
      : Promise.resolve({ data: [] }),
    k.sesiId
      ? supabase.from("absensi").select("status").eq("sesi_id", k.sesiId).returns<{ status: string }[]>()
      : Promise.resolve({ data: null }),
    getPengajuanIzin({ kejadian: { kegiatanId, kelompokId: k.kelompokId, tanggal } }),
  ]);
  const namaKelompok = new Map(akses.kelompokFitur.map((x) => [x.id, x.nama]));
  const kunci = { kegiatanId, kelompokId: k.kelompokId, tanggal, mulaiJadwal: k.mulaiJadwal };
  const bolehAbsensi = bolehBukaAbsensi(aksesAbsensi, k.kelompokId);
  const hadir = ringkas.data?.filter((r) => r.status === "hadir").length ?? 0;
  const bisaDibukaMulai = belumBisaDibuka(k.mulai);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={k.kegiatan.nama}
        description={`${tanggalJam(k.mulai)}${k.kelompokId ? ` · ${namaKelompok.get(k.kelompokId)}` : " · Tingkat desa"}${
          k.kegiatan.lokasi ? ` · ${k.kegiatan.lokasi}` : ""
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            {k.kegiatan.hanya_generus && <Badge nada="utama">Generus</Badge>}
            {k.status === "dibatalkan" ? <Badge nada="bahaya">Libur / batal</Badge> : <Badge nada="sukses">Terjadwal</Badge>}
            {k.dipindah && <Badge>Dipindah dari {tanggalJam(k.mulaiJadwal)}</Badge>}
          </div>
        }
      />

      {k.status === "dibatalkan" ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            <span className="font-semibold">Libur / batal:</span> {k.alasanBatal}
          </p>
          {kelola && <TombolAksi aksi={aktifkanPertemuan.bind(null, kunci)} label="Aktifkan lagi" varian="kedua" />}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ClipboardCheck className="size-7 shrink-0 text-primary" aria-hidden />
          <div className="flex-1 text-sm">
            {k.sesiId ? (
              <>
                <span className="font-semibold">Absensi sudah dibuka</span> · {hadir} hadir tercatat.
              </>
            ) : bisaDibukaMulai ? (
              <>
                Absensi belum dibuka. Bisa dibuka mulai{" "}
                <span className="font-semibold">{tanggalJam(bisaDibukaMulai)}</span> (2 jam sebelum mulai).
              </>
            ) : (
              <>Absensi belum dibuka. Buka saat pertemuan dimulai, lalu scan kartu / tampilkan QR layar.</>
            )}
          </div>
          {k.sesiId ? (
            <Link href={`/absensi/${k.sesiId}`} className={buttonClass("utama", "h-9 px-4")}>
              Lihat absensi
            </Link>
          ) : bolehAbsensi && bisaDibukaMulai ? (
            <button type="button" disabled className={buttonClass("utama", "h-9 px-4")}>
              Belum bisa dibuka
            </button>
          ) : bolehAbsensi ? (
            <TombolAksi aksi={bukaAbsensiPertemuan.bind(null, { ...kunci, mulai: k.mulai })} label="Buka absensi" varian="utama" />
          ) : null}
        </Card>
      )}

      {pengajuan.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">
            Izin dari generus · {pengajuan.filter((p) => p.status === "menunggu").length} menunggu
          </h2>
          <DaftarPengajuan pengajuan={pengajuan} tampilkanKegiatan={false} />
        </section>
      )}

      {kelola ? (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Pemateri & materi</h2>
          <FormPertemuan
            aksi={simpanPertemuan.bind(null, kunci)}
            muballigh={(muballigh ?? []).map((m) => ({
              id: m.id,
              label: `${m.nama_lengkap}${m.jenis_muballigh ? ` (${labelJenisMuballigh(m.jenis_muballigh, m.jenis_kelamin)})` : ""}${
                m.kelompok ? ` · ${m.kelompok.nama}` : ""
              }`,
            }))}
            awal={{
              pemateriId: k.pemateriJamaahId,
              pemateri: k.pemateri,
              materi: k.materi,
              catatan: k.catatan,
              mulai: keInputWib(k.mulai),
            }}
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted">Pemateri:</span> {k.pemateri ?? "Belum diisi"}
          </p>
          <p>
            <span className="text-muted">Materi:</span> {k.materi ?? "Belum diisi"}
          </p>
          {k.catatan && (
            <p>
              <span className="text-muted">Catatan:</span> {k.catatan}
            </p>
          )}
        </Card>
      )}

      {kelola && k.status === "terjadwal" && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Libur / batalkan pertemuan ini</h2>
          <p className="text-sm text-muted">
            Hanya pertemuan tanggal ini. Untuk mengubah jadwal rutinnya, buka Kelola kegiatan.
          </p>
          <FormBatalPertemuan aksi={batalkanPertemuan.bind(null, kunci)} />
        </Card>
      )}
    </div>
  );
}
