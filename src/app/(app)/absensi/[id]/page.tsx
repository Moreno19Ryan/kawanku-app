import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { FormSesi } from "@/components/absensi/form-sesi";
import { PanelScan } from "@/components/absensi/panel-scan";
import { PilihStatus } from "@/components/absensi/pilih-status";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bolehCatatSesi,
  bolehKelolaSesi,
  getAksesAbsensi,
  KOLOM_SESI,
  type Sesi,
} from "@/lib/absensi/akses";
import { aturSesiDitutup, catatKode, hapusSesi, ubahSesi, ubahStatusPeserta } from "@/lib/absensi/actions";
import { LABEL_ALASAN_IZIN } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { keInputWib, tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Sesi absensi",
};

type Cari = { q?: string | string[]; tampil?: string | string[] };
type Peserta = { id: string; kode: string; nama_lengkap: string; kelompok_id: string };
type Catatan = {
  jamaah_id: string;
  status: "hadir" | "izin" | "sakit";
  alasan_izin: string | null;
  jalur: "kartu" | "manual" | "layar";
  dicatat_at: string;
};

const TAMPIL = {
  semua: "Semua",
  belum: "Belum tercatat",
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
} as const;

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function SesiPage({ params, searchParams }: PageProps<"/absensi/[id]">) {
  return (
    <>
      <Link
        href="/absensi"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <Suspense fallback={<Skeleton className="mt-6 h-96" />}>
        <DetailSesi params={params} cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

async function DetailSesi({ params, cari }: { params: Promise<{ id: string }>; cari: Promise<Cari> }) {
  const [{ id }, param, akses] = await Promise.all([params, cari, getAksesAbsensi()]);
  if (!akses?.bolehLihat) return <AbsensiBelumMenyala />;

  const supabase = await createClient();
  const { data: sesi } = await supabase.from("sesi_absensi").select(KOLOM_SESI).eq("id", id).maybeSingle<Sesi>();
  if (!sesi) notFound();

  const kelompokIds = akses.kelompokLihat
    .map((k) => k.id)
    .filter((k) => sesi.kelompok_id === null || k === sesi.kelompok_id);
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));

  let qPeserta = supabase
    .from("jamaah_dengan_kategori")
    .select("id, kode, nama_lengkap, kelompok_id")
    .eq("aktif", true)
    .in("kelompok_id", kelompokIds)
    .order("nama_lengkap");
  if (sesi.hanya_generus) qPeserta = qPeserta.eq("termasuk_generus", true);

  const [{ data: peserta }, { data: catatan }, { data: keringanan }] = await Promise.all([
    qPeserta.returns<Peserta[]>(),
    supabase
      .from("absensi")
      .select("jamaah_id, status, alasan_izin, jalur, dicatat_at")
      .eq("sesi_id", id)
      .returns<Catatan[]>(),
    akses.bolehLihatKeringanan
      ? supabase.from("jamaah_keringanan").select("jamaah_id").eq("aktif", true).returns<{ jamaah_id: string }[]>()
      : Promise.resolve({ data: [] as { jamaah_id: string }[] }),
  ]);

  const petaCatatan = new Map((catatan ?? []).map((c) => [c.jamaah_id, c]));
  const daftar = [...(peserta ?? [])];
  // Catatan milik jamaah yang kini di luar daftar peserta (mis. sudah nonaktif) tetap ditampilkan.
  const lain = (catatan ?? []).filter((c) => !daftar.some((p) => p.id === c.jamaah_id)).map((c) => c.jamaah_id);
  if (lain.length) {
    const { data } = await supabase
      .from("jamaah")
      .select("id, kode, nama_lengkap, kelompok_id")
      .in("id", lain)
      .returns<Peserta[]>();
    daftar.push(...(data ?? []));
    daftar.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, "id"));
  }
  const ringan = new Set((keringanan ?? []).map((k) => k.jamaah_id));

  const jumlah = { hadir: 0, izin: 0, sakit: 0 };
  for (const c of catatan ?? []) jumlah[c.status] += 1;
  const belum = daftar.filter((p) => !petaCatatan.has(p.id)).length;

  const tampil = (satu(param.tampil) in TAMPIL ? satu(param.tampil) : "semua") as keyof typeof TAMPIL;
  const q = satu(param.q).trim().slice(0, 60).toLowerCase();
  const terlihat = daftar.filter((p) => {
    const c = petaCatatan.get(p.id);
    if (tampil === "belum" ? c : tampil !== "semua" && c?.status !== tampil) return false;
    return !q || p.nama_lengkap.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q);
  });

  const kelola = bolehKelolaSesi(akses, sesi);
  const bolehCatat = bolehCatatSesi(akses, sesi);
  const wilayah = sesi.kelompok_id ? (namaKelompok.get(sesi.kelompok_id) ?? "Kelompok") : "Seluruh desa";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sesi.nama}
        description={`${tanggalJam(sesi.mulai)}${sesi.selesai ? ` – ${tanggalJam(sesi.selesai)}` : ""} · ${wilayah}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {sesi.hanya_generus && <Badge nada="utama">Generus saja</Badge>}
            <Badge nada={sesi.ditutup ? "netral" : "sukses"}>{sesi.ditutup ? "Ditutup" : "Dibuka"}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Hadir", nilai: jumlah.hadir, kelas: "text-success" },
          { label: "Izin", nilai: jumlah.izin, kelas: "text-primary" },
          { label: "Sakit", nilai: jumlah.sakit, kelas: "text-warning" },
          { label: "Belum tercatat", nilai: belum, kelas: "text-muted" },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col gap-1">
            <span className="text-sm text-muted">{s.label}</span>
            <span className={`text-3xl font-bold ${s.kelas}`}>{s.nilai}</span>
          </Card>
        ))}
      </div>

      {bolehCatat && !sesi.ditutup && (
        <Card>
          <h2 className="mb-3 font-semibold">Scan kehadiran</h2>
          <PanelScan catat={catatKode.bind(null, sesi.id)} bolehLihatKeringanan={akses.bolehLihatKeringanan} />
        </Card>
      )}
      {bolehCatat && sesi.ditutup && (
        <Card className="text-sm text-muted">
          Sesi sudah ditutup: scan kartu tidak diterima. Status izin/sakit masih bisa dikoreksi dari daftar di
          bawah{kelola ? ", atau buka kembali sesinya." : "."}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <form method="get" className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
          <div className="relative sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Cari nama atau kode jamaah"
              aria-label="Cari peserta"
              className={`${INPUT_CLASS} w-full pl-11`}
            />
          </div>
          <select name="tampil" defaultValue={tampil} aria-label="Tampilkan" className={`${INPUT_CLASS} w-full sm:w-48`}>
            {Object.entries(TAMPIL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass("kedua", "h-12 shrink-0")}>
            Tampilkan
          </button>
        </form>

        <p className="px-1 text-sm text-muted">
          {terlihat.length} dari {daftar.length} peserta
          {sesi.hanya_generus ? " (generus aktif)" : " (jamaah aktif)"}
        </p>
        {terlihat.length === 0 ? (
          <Card className="text-center text-sm text-muted">Tidak ada peserta yang cocok.</Card>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {terlihat.map((p) => {
              const c = petaCatatan.get(p.id);
              const nilai = !c ? "" : c.status === "izin" ? `izin:${c.alasan_izin}` : c.status;
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/jamaah/${p.id}`} className="font-medium hover:underline">
                        {p.nama_lengkap}
                      </Link>
                      {ringan.has(p.id) && <Badge>Keringanan</Badge>}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {[
                        p.kode,
                        sesi.kelompok_id ? null : namaKelompok.get(p.kelompok_id),
                        c
                          ? `${c.status === "izin" ? `Izin (${LABEL_ALASAN_IZIN[c.alasan_izin ?? ""]?.toLowerCase()})` : c.status === "hadir" ? "Hadir" : "Sakit"} · ${c.jalur === "kartu" ? "scan kartu" : c.jalur === "layar" ? "scan layar" : "dicatat admin"} · ${tanggalJam(c.dicatat_at)}`
                          : "Belum tercatat",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {bolehCatat ? (
                    <PilihStatus
                      aksi={ubahStatusPeserta.bind(null, sesi.id, p.id)}
                      nilai={nilai}
                      nama={p.nama_lengkap}
                    />
                  ) : (
                    c && <Badge nada={c.status === "hadir" ? "sukses" : "netral"}>{c.status}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {kelola && (
        <Card className="flex flex-col gap-5">
          <h2 className="font-semibold">Kelola sesi</h2>
          <FormSesi
            aksi={ubahSesi.bind(null, sesi.id)}
            awal={{ nama: sesi.nama, mulai: keInputWib(sesi.mulai), selesai: keInputWib(sesi.selesai) }}
          />
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <TombolAksi
              aksi={aturSesiDitutup.bind(null, sesi.id, !sesi.ditutup)}
              label={sesi.ditutup ? "Buka kembali sesi" : "Tutup sesi"}
              varian="kedua"
            />
            <TombolAksi
              aksi={hapusSesi.bind(null, sesi.id)}
              label="Hapus sesi"
              varian="bahaya"
              konfirmasi={`Hapus sesi "${sesi.nama}" beserta semua catatan kehadirannya? Tindakan ini tidak bisa dibatalkan.`}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
