import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { FormJamaah } from "@/components/jamaah/form-jamaah";
import { FormJandaDuda } from "@/components/jamaah/form-janda-duda";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { KembaliKeJamaah } from "@/components/jamaah/kembali";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  aturJandaDuda,
  aturKeringanan,
  hapusJamaah,
  ubahJamaah,
  ubahStatusJamaah,
} from "@/lib/jamaah/actions";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Detail jamaah",
};

type DetailJamaah = {
  id: string;
  kode: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: "L" | "P";
  tanggal_lahir: string | null;
  tahun_lahir: number | null;
  usia: number | null;
  status_pernikahan: string | null;
  status_sekolah: string | null;
  status_sekolah_diperbarui: string | null;
  kelompok_id: string;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
  aktif: boolean;
  updated_at: string;
};

const LABEL_JANDA_DUDA: Record<string, string> = {
  cerai_hidup: "Cerai hidup",
  cerai_mati: "Cerai mati",
};

export default function DetailJamaahPage({ params, searchParams }: PageProps<"/jamaah/[id]">) {
  return (
    <>
      <KembaliKeJamaah />
      <Suspense
        fallback={
          <>
            <PageHeader title="Jamaah" />
            <Skeleton className="h-96" />
          </>
        }
      >
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function tanggalPanjang(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, cari, akses, aturan] = await Promise.all([
    params,
    searchParams,
    getAksesJamaah(),
    getAturanKategori(),
  ]);
  if (!akses || akses.kelompokLihat.length === 0) return <JamaahBelumMenyala />;

  const supabase = await createClient();
  const { data: j } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase
        .from("jamaah_dengan_kategori")
        .select(
          "id, kode, nama_lengkap, nama_panggilan, jenis_kelamin, tanggal_lahir, tahun_lahir, usia, status_pernikahan, status_sekolah, status_sekolah_diperbarui, kelompok_id, kategori_jamaah_nama, termasuk_generus, aktif, updated_at",
        )
        .eq("id", id)
        .maybeSingle<DetailJamaah>()
    : { data: null };

  const kelompok = j && akses.kelompokLihat.find((k) => k.id === j.kelompok_id);
  if (!j || !kelompok) {
    return (
      <>
        <PageHeader title="Jamaah tidak ditemukan" />
        <Card className="text-sm text-muted">
          Data ini tidak ada, sudah dihapus, atau di luar wewenangmu.
        </Card>
      </>
    );
  }

  const [{ data: keringanan }, { data: jandaDuda }] = await Promise.all([
    akses.bolehLihatKeringanan
      ? supabase.from("jamaah_keringanan").select("aktif").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
    akses.bolehLihatJandaDuda && j.status_pernikahan === "janda_duda"
      ? supabase.from("jamaah_janda_duda").select("jenis").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const bolehUbah = akses.kelompokUbah.some((k) => k.id === j.kelompok_id);
  const keringananAktif = Boolean(keringanan?.aktif);
  const baru = cari.baru === "1";

  return (
    <>
      <PageHeader
        title={j.nama_lengkap}
        description={j.nama_panggilan ? `Dipanggil ${j.nama_panggilan}` : undefined}
      />

      {baru && (
        <Card className="mb-4 flex items-center gap-3 bg-success/10 text-sm sm:mb-6">
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
          <p>
            Jamaah ditambahkan dengan kode <span className="font-semibold">{j.kode}</span>.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:gap-6">
        <Card>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge nada="utama">{j.kode}</Badge>
            {j.kategori_jamaah_nama ? (
              <Badge nada={j.termasuk_generus ? "utama" : "netral"}>
                {j.kategori_jamaah_nama}
                {j.termasuk_generus ? " · Generus" : ""}
              </Badge>
            ) : (
              <Badge nada="bahaya">Tanpa kategori</Badge>
            )}
            {!j.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
            {keringananAktif && <Badge>Keringanan</Badge>}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Baris label="Jenis kelamin">{j.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</Baris>
            <Baris label="Lahir">
              {j.tanggal_lahir
                ? tanggalPanjang(j.tanggal_lahir)
                : j.tahun_lahir
                  ? `Tahun ${j.tahun_lahir}`
                  : "Belum diisi"}
            </Baris>
            <Baris label="Usia">{j.usia !== null ? `${j.usia} tahun` : "–"}</Baris>
            <Baris label="Status sekolah">
              {j.status_sekolah ? LABEL_STATUS_SEKOLAH[j.status_sekolah] : "Belum diisi"}
              {j.status_sekolah_diperbarui && (
                <span className="block text-xs font-normal text-muted">
                  Diperbarui {tanggalPanjang(j.status_sekolah_diperbarui)}
                </span>
              )}
            </Baris>
            <Baris label="Status pernikahan">
              {j.status_pernikahan ? LABEL_STATUS_PERNIKAHAN[j.status_pernikahan] : "Belum diisi"}
            </Baris>
            <Baris label="Kelompok">{kelompok.nama}</Baris>
          </dl>
          <p className="mt-5 text-xs text-muted">Terakhir diubah {waktuRelatif(j.updated_at)}.</p>
        </Card>

        {bolehUbah && (
          <Card>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:hidden">
                <span>
                  <span className="block text-lg font-semibold">Ubah data</span>
                  <span className="block text-sm text-muted">Profil, status sekolah & pernikahan, kelompok</span>
                </span>
                <span className="text-sm font-medium text-primary group-open:hidden">Buka</span>
                <span className="hidden text-sm font-medium text-primary group-open:inline">Tutup</span>
              </summary>
              <div className="mt-5">
                <FormJamaah
                  aksi={ubahJamaah.bind(null, j.id)}
                  nilai={j}
                  kelompok={akses.kelompokUbah}
                  aturan={aturan}
                  labelKirim="Simpan perubahan"
                />
              </div>
            </details>
          </Card>
        )}

        {akses.bolehLihatJandaDuda && j.status_pernikahan === "janda_duda" && (
          <Card>
            <h2 className="text-lg font-semibold">Keterangan janda/duda</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              Data terbatas, hanya terlihat oleh admin yang berizin. Tanpa alasan atau detail lain.
            </p>
            {akses.bolehKelolaJandaDuda ? (
              <FormJandaDuda aksi={aturJandaDuda.bind(null, j.id)} jenis={jandaDuda?.jenis ?? null} />
            ) : (
              <p className="font-medium">
                {jandaDuda ? LABEL_JANDA_DUDA[jandaDuda.jenis] : "Belum diketahui"}
              </p>
            )}
          </Card>
        )}

        {akses.bolehLihatKeringanan && (
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Jalur keringanan absensi</h2>
              <p className="mt-1 text-sm text-muted">
                Untuk generus tanpa HP: absen memakai kartu QR fisik. Penanda ini hanya terlihat
                admin. Status: <span className="font-medium text-fg">{keringananAktif ? "Ya" : "Tidak"}</span>
              </p>
            </div>
            {akses.bolehKelolaKeringanan && (
              <TombolAksi
                aksi={aturKeringanan.bind(null, j.id, !keringananAktif)}
                label={keringananAktif ? "Cabut penanda" : "Tandai keringanan"}
              />
            )}
          </Card>
        )}

        {(bolehUbah || akses.bolehHapus) && (
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Status data</h2>
            {bolehUbah && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  {j.aktif
                    ? "Nonaktifkan bila jamaah pindah atau wafat. Datanya tetap tersimpan dan bisa diaktifkan lagi."
                    : "Jamaah ini nonaktif dan tidak muncul di daftar utama."}
                </p>
                <TombolAksi
                  aksi={ubahStatusJamaah.bind(null, j.id, !j.aktif)}
                  label={j.aktif ? "Nonaktifkan" : "Aktifkan kembali"}
                  konfirmasi={j.aktif ? `Nonaktifkan ${j.nama_lengkap}?` : undefined}
                />
              </div>
            )}
            {akses.bolehHapus && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  Hapus permanen hanya untuk data salah input (mis. dobel). Tidak bisa dibatalkan.
                </p>
                <TombolAksi
                  aksi={hapusJamaah.bind(null, j.id)}
                  label="Hapus permanen"
                  varian="bahaya"
                  konfirmasi={`Hapus ${j.nama_lengkap} (${j.kode}) secara permanen? Tindakan ini tidak bisa dibatalkan.`}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
