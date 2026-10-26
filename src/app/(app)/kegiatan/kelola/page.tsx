import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { FormBuatKegiatan } from "@/components/kegiatan/form-kegiatan";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { buatKegiatan } from "@/lib/kegiatan/actions";
import { KOLOM_KEGIATAN } from "@/lib/kegiatan/data";
import { ringkasJadwal, type Jadwal, type Kegiatan } from "@/lib/kegiatan/jadwal";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Kelola kegiatan",
};

export default function KelolaKegiatanPage() {
  return (
    <>
      <Link href="/kegiatan" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Kegiatan
      </Link>
      <PageHeader title="Kelola kegiatan" description="Kegiatan rutin berjadwal dan agenda sekali jalan." />
      <Suspense fallback={<Memuat className="h-96" />}>
        <Daftar />
      </Suspense>
    </>
  );
}

async function Daftar() {
  const akses = await getAksesKegiatan();
  if (!akses || akses.kelompokLihat.length === 0) return <KegiatanBelumMenyala />;
  const supabase = await createClient();
  const [{ data: kegiatan }, { data: jadwal }] = await Promise.all([
    supabase.from("kegiatan").select(KOLOM_KEGIATAN).order("jenis").order("nama").returns<Kegiatan[]>(),
    supabase.from("kegiatan_jadwal").select("id, kegiatan_id, hari, jam, kecuali_pekan_ke").returns<Jadwal[]>(),
  ]);
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const wilayah = (k: Kegiatan) =>
    k.kelompok_id ? (namaKelompok.get(k.kelompok_id) ?? "Kelompok") : "Tingkat desa";

  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
        {(kegiatan ?? []).map((k) => (
          <li key={k.id}>
            <Link
              href={`/kegiatan/kelola/${k.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{k.nama}</span>
                  <Badge>{k.jenis === "rutin" ? "Rutin" : "Agenda"}</Badge>
                  {k.hanya_generus && <Badge nada="utama">Generus</Badge>}
                  {!k.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
                </span>
                <span className="block text-sm text-muted">
                  {wilayah(k)}
                  {k.jenis === "rutin" ? ` · ${ringkasJadwal((jadwal ?? []).filter((j) => j.kegiatan_id === k.id)) || "Belum ada jadwal"}` : ""}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
        {(kegiatan ?? []).length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Belum ada kegiatan.</li>}
      </ul>

      {akses.targetKegiatan.length > 0 && (
        <Card>
          <h2 className="mb-4 font-semibold">Buat kegiatan baru</h2>
          <FormBuatKegiatan aksi={buatKegiatan} target={akses.targetKegiatan} />
        </Card>
      )}
    </div>
  );
}
