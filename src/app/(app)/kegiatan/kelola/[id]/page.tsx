import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { DaftarKejadian } from "@/components/kegiatan/daftar-kejadian";
import { KegiatanBelumMenyala } from "@/components/kegiatan/belum-menyala";
import { FormJadwal, FormUbahKegiatan } from "@/components/kegiatan/form-kegiatan";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Card } from "@/components/ui/card";
import { bolehKelolaPertemuan, getAksesKegiatan } from "@/lib/kegiatan/akses";
import { hapusKegiatan, simpanJadwal, ubahKegiatan } from "@/lib/kegiatan/actions";
import { getKalender, KOLOM_KEGIATAN } from "@/lib/kegiatan/data";
import { hariIniWib, ringkasJadwal, tambahHari, type Jadwal, type Kegiatan } from "@/lib/kegiatan/jadwal";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Kegiatan",
};

export default function KegiatanDetailPage({ params }: PageProps<"/kegiatan/kelola/[id]">) {
  return (
    <>
      <Link href="/kegiatan/kelola" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Kelola kegiatan
      </Link>
      <Suspense fallback={<Memuat className="mt-6 h-96" />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, akses] = await Promise.all([params, getAksesKegiatan()]);
  if (!akses || akses.kelompokLihat.length === 0) return <KegiatanBelumMenyala />;
  const supabase = await createClient();
  const [{ data: k }, { data: jadwal }] = await Promise.all([
    supabase.from("kegiatan").select(KOLOM_KEGIATAN).eq("id", id).maybeSingle<Kegiatan>(),
    supabase.from("kegiatan_jadwal").select("id, kegiatan_id, hari, jam, kecuali_pekan_ke").eq("kegiatan_id", id).returns<Jadwal[]>(),
  ]);
  if (!k) notFound();
  const namaKelompok = new Map(akses.kelompokFitur.map((x) => [x.id, x.nama]));
  const kelola = bolehKelolaPertemuan(akses, k.kelompok_id, k.hanya_generus);
  const hariIni = hariIniWib();
  const mendatang = (await getKalender(hariIni, tambahHari(hariIni, 34), akses.kelompokLihat.map((x) => x.id))).filter(
    (x) => x.kegiatan.id === k.id,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={k.nama}
        description={`${k.jenis === "rutin" ? "Rutin" : "Agenda"} · ${
          k.per_kelompok ? "Serentak di setiap kelompok" : k.kelompok_id ? namaKelompok.get(k.kelompok_id) : "Tingkat desa"
        }${k.hanya_generus ? " · Generus" : ""}${k.jenis === "rutin" ? ` · ${ringkasJadwal(jadwal ?? [])}` : ""}`}
      />

      {kelola && (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">Data kegiatan</h2>
            <FormUbahKegiatan aksi={ubahKegiatan.bind(null, k.id)} awal={k} />
          </Card>
          {k.jenis === "rutin" && (
            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="font-semibold">Jadwal rutin</h2>
                <p className="text-sm text-muted">
                  Ubah bila ada keputusan musyawarah. Untuk libur satu tanggal saja, tandai di pertemuannya.
                </p>
              </div>
              <FormJadwal aksi={simpanJadwal.bind(null, k.id)} awal={jadwal ?? []} />
            </Card>
          )}
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 font-semibold">Pertemuan 5 pekan ke depan</h2>
        <DaftarKejadian
          kejadian={mendatang}
          namaKelompok={namaKelompok}
          kosong="Tidak ada pertemuan terjadwal (cek jadwal atau status aktif)."
        />
      </section>

      {kelola && (
        <div className="flex justify-end">
          <TombolAksi
            aksi={hapusKegiatan.bind(null, k.id)}
            label="Hapus kegiatan"
            varian="bahaya"
            konfirmasi={`Hapus "${k.nama}" beserta semua catatan pertemuannya (pemateri, materi)? Sesi absensi yang sudah ada tetap tersimpan.`}
          />
        </div>
      )}
    </div>
  );
}
