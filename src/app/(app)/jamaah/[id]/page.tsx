import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { FormJamaah } from "@/components/jamaah/form-jamaah";
import {
  FormIdentitas,
  FormKontak,
  FormPribadi,
  NomorTersamar,
  type NilaiPribadi,
} from "@/components/jamaah/form-data-sensitif";
import { DaftarUsulan } from "@/components/jamaah/daftar-usulan";
import { FormJandaDuda } from "@/components/jamaah/form-janda-duda";
import { FormHubungkan } from "@/components/jamaah/form-keluarga";
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
  simpanIdentitas,
  simpanKontak,
  simpanPribadi,
  ubahJamaah,
  ubahStatusJamaah,
} from "@/lib/jamaah/actions";
import { getAksesJamaah, getAturanKategori } from "@/lib/jamaah/akses";
import { formatNoHp } from "@/lib/jamaah/format";
import { buatKeluargaDariJamaah, hubungkanKeKeluarga } from "@/lib/jamaah/keluarga-actions";
import { cariPemeriksaan, getPerluDicek } from "@/lib/jamaah/periksa";
import { getUsulanMenunggu } from "@/lib/jamaah/usulan";
import {
  dokumenIdentitas,
  LABEL_HUBUNGAN,
  LABEL_PENDIDIKAN,
  LABEL_STATUS_PERNIKAHAN,
  labelSekolah,
  labelJenisMuballigh,
  labelMuballigh,
} from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { tanggalPanjang, waktuRelatif } from "@/lib/waktu";

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
  kelas: number | null;
  kelompok_id: string;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
  aktif: boolean;
  updated_at: string;
  tempat_lahir: string | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  muballigh: boolean;
  jenis_muballigh: string | null;
  paket_caberawit: string | null;
  keluarga_id: string | null;
  hubungan_keluarga: string | null;
};

type DataPribadi = NilaiPribadi & { ktp_wilayah: string | null; dom_wilayah: string | null };

/** Alamat satu baris: "Jl. …, RT 003/RW 013, Wanasari, Cibitung, …, 17520". */
function alamatSatuBaris(a: DataPribadi, awalan: "ktp" | "dom"): string | null {
  const jalan = a[`${awalan}_jalan`];
  const rt = a[`${awalan}_rt`];
  const rw = a[`${awalan}_rw`];
  const wilayah = a[`${awalan}_wilayah`];
  const pos = a[`${awalan}_kode_pos`];
  const rtRw =
    rt !== null || rw !== null
      ? `RT ${String(rt ?? "–").padStart(3, "0")}/RW ${String(rw ?? "–").padStart(3, "0")}`
      : null;
  const bagian = [jalan, rtRw, wilayah, pos].filter(Boolean);
  return bagian.length ? bagian.join(", ") : null;
}

function Lipat({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <details className="group mt-5 border-t border-border pt-4">
      <summary className="cursor-pointer list-none text-sm font-medium text-primary marker:hidden">
        <span className="group-open:hidden">{judul}</span>
        <span className="hidden group-open:inline">Tutup</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

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
          "id, kode, nama_lengkap, nama_panggilan, jenis_kelamin, tanggal_lahir, tahun_lahir, usia, status_pernikahan, status_sekolah, status_sekolah_diperbarui, kelas, kelompok_id, kategori_jamaah_nama, termasuk_generus, aktif, updated_at, tempat_lahir, pendidikan_terakhir, kegiatan, muballigh, jenis_muballigh, paket_caberawit, keluarga_id, hubungan_keluarga",
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

  const [{ data: keringanan }, { data: jandaDuda }, { data: kontak }, { data: pribadi }, { data: identitas }] = await Promise.all([
    akses.bolehLihatKeringanan
      ? supabase.from("jamaah_keringanan").select("aktif").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
    akses.bolehLihatJandaDuda && j.status_pernikahan === "janda_duda"
      ? supabase.from("jamaah_janda_duda").select("jenis").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Data sensitif: hanya diambil bila berizin (RLS tetap pembatasnya).
    akses.bolehLihatKontak
      ? supabase.from("jamaah_kontak").select("no_hp, no_hp_wali, email").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
    akses.bolehLihatPribadi
      ? supabase
          .from("jamaah_pribadi")
          .select(
            "nama_ayah, nama_ibu, ktp_kode_wilayah, ktp_wilayah, ktp_jalan, ktp_rt, ktp_rw, ktp_kode_pos, domisili_sama_ktp, dom_kode_wilayah, dom_wilayah, dom_jalan, dom_rt, dom_rw, dom_kode_pos",
          )
          .eq("jamaah_id", j.id)
          .maybeSingle<DataPribadi>()
      : Promise.resolve({ data: null }),
    akses.bolehLihatIdentitas
      ? supabase.from("jamaah_identitas").select("nik, no_kk").eq("jamaah_id", j.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const bolehUbah = akses.kelompokUbah.some((k) => k.id === j.kelompok_id);
  const keringananAktif = Boolean(keringanan?.aktif);
  const baru = cari.baru === "1";

  // Keluarga: hanya untuk pemegang keluarga.lihat di kelompok jamaah ini.
  const lihatKeluarga = akses.kelompokKeluargaLihat.some((k) => k.id === j.kelompok_id);
  const kelolaKeluarga = akses.kelompokKeluargaKelola.some((k) => k.id === j.kelompok_id);
  const [{ data: keluarga }, { data: serumah }, { data: pilihanKeluarga }] = await Promise.all([
    lihatKeluarga && j.keluarga_id
      ? supabase.from("keluarga").select("id, nama").eq("id", j.keluarga_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lihatKeluarga && j.keluarga_id
      ? supabase
          .from("jamaah")
          .select("id, nama_lengkap, hubungan_keluarga")
          .eq("keluarga_id", j.keluarga_id)
          .neq("id", j.id)
          .order("nama_lengkap")
      : Promise.resolve({ data: [] as { id: string; nama_lengkap: string; hubungan_keluarga: string | null }[] }),
    kelolaKeluarga && !j.keluarga_id
      ? supabase.from("keluarga").select("id, nama").eq("kelompok_id", j.kelompok_id).order("nama")
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
  const usulan = bolehUbah ? await getUsulanMenunggu(j.id) : [];
  const perluDicek = ((await getPerluDicek())?.perJamaah.get(j.id) ?? [])
    .map(cariPemeriksaan)
    .filter((p) => p !== undefined);

  return (
    <>
      <PageHeader
        title={j.nama_lengkap}
        description={j.nama_panggilan ? `Dipanggil ${j.nama_panggilan}` : undefined}
      />

      {perluDicek.length > 0 && (
        <Card className="mb-4 flex items-start gap-3 bg-warning/10 sm:mb-6">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Perlu dicek</p>
            <ul className="mt-1 list-disc pl-4 text-muted">
              {perluDicek.map((p) => (
                <li key={p.kode}>
                  <span className="font-medium text-fg">{p.judul}.</span> {p.saran}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {usulan.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <DaftarUsulan usulan={usulan} tampilkanNama={false} />
        </div>
      )}

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
              {j.tempat_lahir && `${j.tempat_lahir}, `}
              {j.tanggal_lahir
                ? tanggalPanjang(j.tanggal_lahir)
                : j.tahun_lahir
                  ? `Tahun ${j.tahun_lahir}`
                  : "Belum diisi"}
            </Baris>
            <Baris label="Usia">{j.usia !== null ? `${j.usia} tahun` : "–"}</Baris>
            <Baris label="Status sekolah">
              {labelSekolah(j.status_sekolah, j.kelas)}
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
            <Baris label="Pendidikan terakhir">
              {j.pendidikan_terakhir ? LABEL_PENDIDIKAN[j.pendidikan_terakhir] : "–"}
            </Baris>
            <Baris label="Pekerjaan / kegiatan">{j.kegiatan ?? "–"}</Baris>
            {j.muballigh && (
              <Baris label={labelMuballigh(j.jenis_kelamin)}>
                {j.jenis_muballigh
                  ? labelJenisMuballigh(j.jenis_muballigh, j.jenis_kelamin)
                  : "Ya · penugasan (MT/MS) belum dipilih"}
              </Baris>
            )}
            {j.paket_caberawit && <Baris label="Paket caberawit">Paket {j.paket_caberawit}</Baris>}
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

        {lihatKeluarga && (
          <Card>
            <h2 className="text-lg font-semibold">Keluarga</h2>
            {keluarga ? (
              <>
                <p className="mt-2">
                  <Link href={`/jamaah/keluarga/${keluarga.id}`} className="font-medium text-primary hover:underline">
                    {keluarga.nama}
                  </Link>
                  <span className="text-muted">
                    {" "}
                    · {j.hubungan_keluarga ? LABEL_HUBUNGAN[j.hubungan_keluarga] : "hubungan belum diisi"}
                  </span>
                </p>
                {serumah && serumah.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-sm">
                    {serumah.map((a) => (
                      <li key={a.id}>
                        <Link href={`/jamaah/${a.id}`} className="hover:text-primary">
                          {a.nama_lengkap}
                        </Link>
                        <span className="text-muted">
                          {" "}
                          · {a.hubungan_keluarga ? LABEL_HUBUNGAN[a.hubungan_keluarga] : "–"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Belum masuk keluarga mana pun.</p>
            )}
            {kelolaKeluarga && !j.keluarga_id && (
              <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                {pilihanKeluarga && pilihanKeluarga.length > 0 && (
                  <FormHubungkan aksi={hubungkanKeKeluarga.bind(null, j.id)} keluarga={pilihanKeluarga} />
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">Belum ada keluarganya? Buat baru dengan jamaah ini sebagai kepala keluarga.</p>
                  <TombolAksi aksi={buatKeluargaDariJamaah.bind(null, j.id)} label="Buat keluarga" />
                </div>
              </div>
            )}
          </Card>
        )}

        {akses.bolehLihatKontak && (
          <Card>
            <h2 className="text-lg font-semibold">Kontak</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Baris label="No. HP/WhatsApp">
                {kontak?.no_hp ? (
                  <a
                    href={`https://wa.me/62${kontak.no_hp.slice(1)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formatNoHp(kontak.no_hp)}
                  </a>
                ) : (
                  "–"
                )}
              </Baris>
              <Baris label="No. HP orang tua/wali">
                {kontak?.no_hp_wali ? (
                  <a
                    href={`https://wa.me/62${kontak.no_hp_wali.slice(1)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formatNoHp(kontak.no_hp_wali)}
                  </a>
                ) : (
                  "–"
                )}
              </Baris>
              <Baris label="Email">
                <span className="break-all">{kontak?.email ?? "–"}</span>
              </Baris>
            </dl>
            {akses.bolehKelolaKontak && (
              <Lipat judul={kontak ? "Ubah kontak" : "Isi kontak"}>
                <FormKontak aksi={simpanKontak.bind(null, j.id)} nilai={kontak} />
              </Lipat>
            )}
          </Card>
        )}

        {akses.bolehLihatPribadi && (
          <Card>
            <h2 className="text-lg font-semibold">Orang tua & alamat</h2>
            <p className="mt-1 text-sm text-muted">Data terbatas, hanya untuk admin yang berizin.</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Baris label="Nama ayah kandung">{pribadi?.nama_ayah ?? "–"}</Baris>
              <Baris label="Nama ibu kandung">{pribadi?.nama_ibu ?? "–"}</Baris>
              <Baris label={`Alamat sesuai ${dokumenIdentitas(j.usia)}`}>
                <span className="font-normal">{(pribadi && alamatSatuBaris(pribadi, "ktp")) ?? "–"}</span>
              </Baris>
              <Baris label="Alamat saat ini (domisili)">
                <span className="font-normal">
                  {pribadi?.domisili_sama_ktp
                    ? `Sama dengan alamat ${dokumenIdentitas(j.usia)}`
                    : ((pribadi && alamatSatuBaris(pribadi, "dom")) ?? "–")}
                </span>
              </Baris>
            </dl>
            {akses.bolehKelolaPribadi && (
              <Lipat judul={pribadi ? "Ubah orang tua & alamat" : "Isi orang tua & alamat"}>
                <FormPribadi aksi={simpanPribadi.bind(null, j.id)} nilai={pribadi} dokumen={dokumenIdentitas(j.usia)} />
              </Lipat>
            )}
          </Card>
        )}

        {akses.bolehLihatIdentitas && (
          <Card>
            <h2 className="text-lg font-semibold">Identitas (NIK & No. KK)</h2>
            <p className="mt-1 text-sm text-muted">
              Opsional, bukan ID jamaah (ID tetap kode {j.kode}). Nomor disamarkan; tekan ikon mata
              untuk menampilkan.
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Baris label="NIK">{identitas?.nik ? <NomorTersamar nomor={identitas.nik} /> : "–"}</Baris>
              <Baris label="No. KK">{identitas?.no_kk ? <NomorTersamar nomor={identitas.no_kk} /> : "–"}</Baris>
            </dl>
            {akses.bolehKelolaIdentitas && (
              <Lipat judul={identitas ? "Ubah NIK & No. KK" : "Isi NIK & No. KK"}>
                <FormIdentitas aksi={simpanIdentitas.bind(null, j.id)} nilai={identitas} />
              </Lipat>
            )}
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
                Untuk generus tanpa HP: absen memakai kartu QR fisik (generus lain absen lewat akunnya).
                Mencabut penanda ikut mencabut kartu fisiknya. Penanda ini hanya terlihat admin. Status: <span className="font-medium text-fg">{keringananAktif ? "Ya" : "Tidak"}</span>
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
