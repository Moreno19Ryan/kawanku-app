import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { FormHubungan, FormNamaKeluarga, FormTambahAnggota } from "@/components/jamaah/form-keluarga";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import {
  hapusKeluarga,
  lepasAnggota,
  tambahAnggota,
  ubahHubungan,
  ubahNamaKeluarga,
} from "@/lib/jamaah/keluarga-actions";
import { LABEL_HUBUNGAN } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Detail keluarga",
};

type Anggota = {
  id: string;
  nama_lengkap: string;
  kode: string;
  usia: number | null;
  hubungan_keluarga: string | null;
  kategori_jamaah_nama: string | null;
  aktif: boolean;
};

/** Urutan tampil: kepala, pasangan, anak (tua → muda), orang tua, lainnya. */
const URUTAN = ["kepala_keluarga", "pasangan", "anak", "orang_tua", "lainnya"];

export default function DetailKeluargaPage({ params }: PageProps<"/jamaah/keluarga/[id]">) {
  return (
    <>
      <Link
        href="/jamaah/keluarga"
        className="-ml-2 mt-6 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft lg:mt-8"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Keluarga
      </Link>
      <Suspense
        fallback={
          <>
            <PageHeader title="Keluarga" />
            <Memuat className="h-96" />
          </>
        }
      >
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, akses] = await Promise.all([params, getAksesJamaah()]);
  if (!akses || akses.kelompokKeluargaLihat.length === 0) return <JamaahBelumMenyala />;

  const supabase = await createClient();
  const { data: k } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("keluarga").select("id, nama, kelompok_id").eq("id", id).maybeSingle()
    : { data: null };
  const kelompok = k && akses.kelompokKeluargaLihat.find((x) => x.id === k.kelompok_id);
  if (!k || !kelompok) {
    return (
      <>
        <PageHeader title="Keluarga tidak ditemukan" />
        <Card className="text-sm text-muted">Mohon maaf, data ini tidak ditemukan, sudah dihapus, atau di luar wewenang akun ini.</Card>
      </>
    );
  }

  const bolehKelola = akses.kelompokKeluargaKelola.some((x) => x.id === k.kelompok_id);
  const [{ data: anggota }, { data: kandidat }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select("id, nama_lengkap, kode, usia, hubungan_keluarga, kategori_jamaah_nama, aktif")
      .eq("keluarga_id", k.id)
      .returns<Anggota[]>(),
    bolehKelola
      ? supabase
          .from("jamaah")
          .select("id, nama_lengkap, kode")
          .eq("kelompok_id", k.kelompok_id)
          .is("keluarga_id", null)
          .eq("aktif", true)
          .order("nama_lengkap")
      : Promise.resolve({ data: [] as { id: string; nama_lengkap: string; kode: string }[] }),
  ]);

  const urut = [...(anggota ?? [])].sort(
    (a, b) =>
      URUTAN.indexOf(a.hubungan_keluarga ?? "lainnya") - URUTAN.indexOf(b.hubungan_keluarga ?? "lainnya") ||
      (b.usia ?? -1) - (a.usia ?? -1),
  );
  const jumlahKepala = urut.filter((a) => a.hubungan_keluarga === "kepala_keluarga").length;

  return (
    <>
      <PageHeader title={k.nama} description={`${kelompok.nama} · ${urut.length} anggota`} />
      <div className="flex flex-col gap-4 sm:gap-6">
        {jumlahKepala !== 1 && urut.length > 0 && (
          <Card className="bg-warning/10 text-sm">
            {jumlahKepala === 0
              ? "Kepala keluarga belum ditentukan. Ubah hubungan salah satu anggota menjadi Kepala keluarga."
              : `Ada ${jumlahKepala} kepala keluarga. Biasanya cukup satu; periksa lagi hubungannya.`}
          </Card>
        )}

        <Card className="p-0 sm:p-0">
          <h2 className="px-5 pt-5 text-lg font-semibold sm:px-6 sm:pt-6">Anggota</h2>
          {urut.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted sm:px-6">Belum ada anggota.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {urut.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/jamaah/${a.id}`} className="font-medium hover:text-primary">
                      {a.nama_lengkap}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <span>{a.hubungan_keluarga ? LABEL_HUBUNGAN[a.hubungan_keluarga] : "Hubungan belum diisi"}</span>
                      <span>· {a.kode}</span>
                      {a.usia !== null && <span>· {a.usia} th</span>}
                      {a.kategori_jamaah_nama && <Badge>{a.kategori_jamaah_nama}</Badge>}
                      {!a.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
                    </p>
                  </div>
                  {bolehKelola && (
                    <div className="flex flex-wrap items-start gap-2">
                      <FormHubungan aksi={ubahHubungan.bind(null, a.id)} nilai={a.hubungan_keluarga} />
                      <TombolAksi
                        aksi={lepasAnggota.bind(null, a.id)}
                        label="Lepas"
                        konfirmasi={`Lepaskan ${a.nama_lengkap} dari ${k.nama}? Data jamaahnya tetap ada.`}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {bolehKelola && (
            <div className="border-t border-border px-5 py-5 sm:px-6">
              <p className="mb-3 text-sm font-medium">Tambah anggota dari {kelompok.nama}</p>
              <FormTambahAnggota
                aksi={tambahAnggota.bind(null, k.id)}
                kandidat={(kandidat ?? []).map((j) => ({ id: j.id, nama: `${j.nama_lengkap} (${j.kode})` }))}
              />
            </div>
          )}
        </Card>

        {bolehKelola && (
          <Card className="flex flex-col gap-5">
            <div>
              <h2 className="mb-3 text-lg font-semibold">Nama keluarga</h2>
              <FormNamaKeluarga aksi={ubahNamaKeluarga.bind(null, k.id)} nama={k.nama} />
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Hapus keluarga ini. Anggotanya tidak ikut terhapus, hanya dilepas dari keluarga.
              </p>
              <TombolAksi
                aksi={hapusKeluarga.bind(null, k.id)}
                label="Hapus keluarga"
                varian="bahaya"
                konfirmasi={`Hapus ${k.nama}? Anggotanya tetap ada sebagai jamaah. Keluarga masuk tempat sampah dan bisa dikembalikan dalam 30 hari.`}
              />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
