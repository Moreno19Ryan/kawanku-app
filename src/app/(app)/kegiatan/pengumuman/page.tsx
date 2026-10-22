import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { FormPengumuman } from "@/components/sistem/form-pengumuman";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  buatPengumumanGenerus,
  hapusPengumumanGenerus,
  ubahStatusPengumumanGenerus,
} from "@/lib/kegiatan/actions";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { KOLOM_PENGUMUMAN, type Pengumuman } from "@/lib/sistem/data";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Pengumuman Generus",
};

export default function PengumumanGenerusPage() {
  return (
    <>
      <Link href="/kegiatan" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Kegiatan
      </Link>
      <PageHeader
        title="Pengumuman generus"
        description="Kabar untuk generus, tampil di beranda akun generus di wilayahnya (mis. jadwal pindah, bawa perlengkapan, agenda baru)."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <Isi />
      </Suspense>
    </>
  );
}

function statusTayang(p: Pengumuman) {
  const sekarang = Date.now();
  if (!p.aktif) return { label: "Disembunyikan", nada: "netral" as const };
  if (new Date(p.mulai).getTime() > sekarang) return { label: "Terjadwal", nada: "utama" as const };
  if (p.berakhir && new Date(p.berakhir).getTime() <= sekarang) return { label: "Berakhir", nada: "netral" as const };
  return { label: "Tayang", nada: "sukses" as const };
}

async function Isi() {
  const akses = await getAksesKegiatan();
  if (!akses || akses.targetKegiatan.length === 0) return <KegiatanBelumMenyala />;
  const wilayah = [
    ...(akses.kelolaDesa ? [{ nilai: "desa", nama: "Seluruh desa" }] : []),
    ...akses.kelompokKelola.map((k) => ({ nilai: k.id, nama: k.nama })),
  ];
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const supabase = await createClient();
  const { data } = await supabase
    .from("pengumuman")
    .select(KOLOM_PENGUMUMAN)
    .in("sasaran", ["generus", "semua"])
    .order("mulai", { ascending: false })
    .limit(30)
    .returns<Pengumuman[]>();
  const bolehUbah = (p: Pengumuman) =>
    p.sasaran === "generus" &&
    (p.kelompok_id === null ? akses.kelolaDesa : akses.kelompokKelola.some((k) => k.id === p.kelompok_id));

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card>
        <h2 className="mb-5 text-lg font-semibold">Pengumuman baru</h2>
        <FormPengumuman aksi={buatPengumumanGenerus} wilayah={wilayah} />
      </Card>
      {(data ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {(data ?? []).map((p) => {
            const status = statusTayang(p);
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge nada={status.nada}>{status.label}</Badge>
                      <Badge>{p.kelompok_id ? (namaKelompok.get(p.kelompok_id) ?? "Kelompok") : "Seluruh desa"}</Badge>
                      {p.sasaran === "semua" && <Badge>Admin & generus</Badge>}
                    </div>
                    <p className="mt-2">{p.pesan}</p>
                    <p className="mt-1 text-xs text-muted">
                      Mulai {tanggalJam(p.mulai)}
                      {p.berakhir ? ` · berakhir ${tanggalJam(p.berakhir)}` : " · tanpa batas"}
                    </p>
                  </div>
                  {bolehUbah(p) && (
                    <div className="flex gap-2 sm:flex-col sm:items-end">
                      <TombolAksi
                        aksi={ubahStatusPengumumanGenerus.bind(null, p.id, !p.aktif)}
                        label={p.aktif ? "Sembunyikan" : "Tayangkan"}
                        varian={p.aktif ? "netral" : "kedua"}
                      />
                      <TombolAksi
                        aksi={hapusPengumumanGenerus.bind(null, p.id)}
                        label="Hapus"
                        varian="bahaya"
                        konfirmasi="Hapus pengumuman ini?"
                      />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
