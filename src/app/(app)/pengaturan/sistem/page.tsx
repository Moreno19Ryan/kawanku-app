import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { FormFitur } from "@/components/sistem/form-fitur";
import { FormPerawatan } from "@/components/sistem/form-perawatan";
import { KartuKesehatan, KartuTugas } from "@/components/sistem/kesehatan-sistem";
import { LaporanMasalah } from "@/components/sistem/laporan-masalah";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";
import { perbaikiData, simpanFitur, tandaiGalatDicek, tanganiPermintaanIdentitas } from "@/lib/sistem/actions";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { getFitur } from "@/lib/sistem/data";
import { jelaskanGalat } from "@/lib/sistem/galat-jelas";
import type { DataKesehatan } from "@/lib/sistem/kesehatan";
import { createClient } from "@/lib/supabase/server";
import { keInputWib, tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Panel pengembang",
};

export default function PanelPengembangPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Panel pengembang"
        description="Hanya untuk akun pengembang. Perubahan di sini berlaku untuk seluruh aplikasi."
      />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <IsiPanel />
      </Suspense>
    </>
  );
}

async function IsiPanel() {
  await wajibIzin("sistem.kelola");
  const supabase = await createClient();

  const [{ data: pengaturan, error: galatPengaturan }, fitur, { data: kelompok }, { count: adminAktif }, latensi] =
    await Promise.all([
      supabase
        .from("pengaturan_sistem")
        .select("mode_perawatan, pesan_perawatan, perkiraan_selesai, updated_at")
        .maybeSingle(),
      getFitur(),
      supabase.from("kelompok").select("id, nama").eq("aktif", true).order("nomor"),
      supabase.from("admin").select("user_id", { count: "exact", head: true }).eq("aktif", true),
      ukurLatensi(supabase),
    ]);

  if (galatPengaturan || !pengaturan) {
    return (
      <Card className="text-sm text-danger">
        Mohon maaf, pengaturan sistem belum bisa dimuat dari database. Silakan muat ulang halaman; bila tetap
        begini, periksa status Supabase.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Kesehatan />
      </Suspense>
      <Card>
        <h2 className="text-lg font-semibold">Salin laporan masalah</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Untuk masalah yang belum selesai lewat Panduan perbaikan. Kesehatan sistem, galat, pemeriksaan data, dan
          jejak aktivitas disusun jadi satu teks untuk ditempel ke chat asisten pengembang, tanpa nama, kontak, atau
          NIK jamaah.
        </p>
        <LaporanMasalah />
      </Card>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <PemeriksaanData />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <PermintaanIdentitas />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <PemantauGalat />
      </Suspense>

      <Card>
        <h2 className="text-lg font-semibold">Mode perawatan</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Untuk pembaruan besar atau perbaikan data. Login tetap bisa; setelah login, admin selain
          pengembang hanya melihat halaman perawatan.
          {process.env.MODE_PERAWATAN === "1" &&
            " Saat ini juga DIPAKSA oleh env MODE_PERAWATAN=1 di Vercel; matikan di sana."}
        </p>
        <FormPerawatan
          aktif={pengaturan.mode_perawatan}
          pesan={pengaturan.pesan_perawatan ?? ""}
          perkiraanSelesai={keInputWib(pengaturan.perkiraan_selesai)}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Saklar fitur</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Nyalakan modul per kelompok, mis. Jamaah untuk Kelompok 1 dulu. Modul yang dimatikan tidak tampil di
          menu kelompok tersebut.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {fitur.map((f) => (
            <li key={f.id} className="py-4 first:pt-0 last:pb-0">
              <FormFitur
                aksi={simpanFitur.bind(null, f.id)}
                nama={f.nama}
                deskripsi={f.deskripsi}
                aktif={f.aktif}
                semuaKelompok={f.semua_kelompok}
                terpilih={f.fitur_kelompok.map((k) => k.kelompok_id)}
                kelompok={kelompok ?? []}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Info sistem</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="Lingkungan" nilai={process.env.VERCEL_ENV ?? "lokal"} />
          <Info label="Region fungsi" nilai={process.env.VERCEL_REGION ?? "–"} />
          <Info
            label="Versi (commit)"
            nilai={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "–"}
            mono
          />
          <Info
            label="Pesan commit"
            nilai={process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? "–"}
          />
          <Info
            label="Waktu build"
            nilai={
              process.env.WAKTU_BUILD
                ? `${tanggalJam(process.env.WAKTU_BUILD)} (${waktuRelatif(process.env.WAKTU_BUILD)})`
                : "–"
            }
          />
          <Info label="Database" nilai={`Terhubung · ${latensi} ms`} />
          <Info label="Admin aktif" nilai={String(adminAktif ?? "–")} />
          <Info
            label="Pengaturan sistem terakhir diubah"
            nilai={`${tanggalJam(pengaturan.updated_at)} (${waktuRelatif(pengaturan.updated_at)})`}
          />
        </dl>
      </Card>
    </div>
  );
}

/** Kesehatan sistem & tugas otomatis (RPC kesehatan_sistem, khusus pengembang). */
async function Kesehatan() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kesehatan_sistem");
  if (error || !data) {
    return (
      <Card className="text-sm text-muted">
        Mohon maaf, kesehatan sistem belum bisa dimuat. Silakan muat ulang halaman.
      </Card>
    );
  }
  const kesehatan = data as DataKesehatan;
  return (
    <>
      <KartuKesehatan data={kesehatan} />
      <KartuTugas data={kesehatan} />
    </>
  );
}

/** Waktu bolak-balik satu kueri ringan ke database (ms). */
async function ukurLatensi(supabase: Awaited<ReturnType<typeof createClient>>) {
  const mulai = performance.now();
  await supabase.from("kelompok").select("id", { head: true, count: "exact" });
  return Math.round(performance.now() - mulai);
}

function Info({ label, nilai, mono = false }: { label: string; nilai: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`mt-0.5 truncate font-medium ${mono ? "font-mono" : ""}`} title={nilai}>
        {nilai}
      </dd>
    </div>
  );
}

type Permintaan = {
  id: string;
  alasan: string;
  status: string;
  created_at: string;
  ditangani_at: string | null;
  pemohon: string;
  jamaah: { nama_lengkap: string; kode: string } | null;
};

/** Permintaan melihat NIK/KK lengkap (disetujui pengembang, berlaku 1 jam) + catatan pembukaan. */
async function PermintaanIdentitas() {
  const supabase = await createClient();
  const [{ data: permintaan }, { data: akses }, { data: admin }] = await Promise.all([
    supabase
      .from("permintaan_identitas")
      .select("id, alasan, status, created_at, ditangani_at, pemohon, jamaah:jamaah_id(nama_lengkap, kode)")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Permintaan[]>(),
    supabase
      .from("akses_identitas")
      .select("created_at, oleh, jamaah:jamaah_id(nama_lengkap)")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<{ created_at: string; oleh: string | null; jamaah: { nama_lengkap: string } | null }[]>(),
    supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
  ]);
  const nama = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));
  const menunggu = (permintaan ?? []).filter((p) => p.status === "menunggu");
  const selesai = (permintaan ?? []).filter((p) => p.status !== "menunggu").slice(0, 5);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Permintaan lihat NIK & No. KK</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        NIK/KK selalu tersamar untuk semua peran. Admin yang perlu nomor lengkap mengajukan di sini; bila disetujui,
        nomornya bisa dilihat selama 1 jam dan setiap pembukaan tercatat.
      </p>
      {menunggu.length === 0 ? (
        <p className="text-sm text-muted">Tidak ada permintaan yang menunggu.</p>
      ) : (
        <ul className="divide-y divide-border">
          {menunggu.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {nama.get(p.pemohon) ?? "Admin"} → {p.jamaah?.nama_lengkap ?? "Jamaah"}{" "}
                  <span className="font-normal text-muted">({p.jamaah?.kode})</span>
                </p>
                <p className="text-muted">
                  {p.alasan} · {waktuRelatif(p.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <TombolAksi aksi={tanganiPermintaanIdentitas.bind(null, p.id, true)} label="Setujui" varian="utama" />
                <TombolAksi aksi={tanganiPermintaanIdentitas.bind(null, p.id, false)} label="Tolak" varian="kedua" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {(selesai.length > 0 || (akses ?? []).length > 0) && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Riwayat</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted">
            {selesai.map((p) => (
              <li key={p.id}>
                {p.status === "disetujui" ? "Disetujui" : "Ditolak"}: {nama.get(p.pemohon) ?? "Admin"} →{" "}
                {p.jamaah?.nama_lengkap} ({tanggalJam(p.ditangani_at ?? p.created_at)})
              </li>
            ))}
            {(akses ?? []).map((a, i) => (
              <li key={i}>
                Dibuka: {nama.get(a.oleh ?? "") ?? "Admin"} → {a.jamaah?.nama_lengkap} ({tanggalJam(a.created_at)})
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

type Galat = {
  id: string;
  sumber: "server" | "klien";
  jenis: string | null;
  rute: string | null;
  pesan: string;
  digest: string | null;
  jumlah: number;
  pertama_at: string;
  terakhir_at: string;
  dicek_at: string | null;
};

const LABEL_JENIS: Record<string, string> = {
  render: "Halaman",
  route: "API",
  action: "Simpan (aksi)",
  proxy: "Proxy",
  klien: "Browser",
};

/** Galat aplikasi yang tercatat otomatis (onRequestError & halaman galat), digabung per jenis. */
async function PemantauGalat() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galat_aplikasi")
    .select("id, sumber, jenis, rute, pesan, digest, jumlah, pertama_at, terakhir_at, dicek_at")
    .order("terakhir_at", { ascending: false })
    .limit(40)
    .returns<Galat[]>();
  if (error) {
    return (
      <Card className="text-sm text-muted">
        Mohon maaf, daftar galat belum bisa dimuat. Silakan muat ulang halaman.
      </Card>
    );
  }
  const baru = (data ?? []).filter((g) => !g.dicek_at);
  const sudah = (data ?? []).filter((g) => g.dicek_at).slice(0, 10);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pemantau galat</h2>
          <p className="mt-1 text-sm text-muted">
            Galat di server maupun di browser pengguna tercatat otomatis. Galat yang sama digabung; yang sudah dicek
            muncul lagi bila terulang.
          </p>
        </div>
        {baru.length > 1 && (
          <TombolAksi aksi={tandaiGalatDicek.bind(null, null)} label="Tandai semua dicek" varian="kedua" />
        )}
      </div>
      {baru.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Alhamdulillah, tidak ada galat baru.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {baru.map((g) => (
            <BarisGalat key={g.id} g={g} />
          ))}
        </ul>
      )}
      {sudah.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Sudah dicek ({sudah.length} terakhir)</summary>
          <ul className="mt-2 divide-y divide-border">
            {sudah.map((g) => (
              <BarisGalat key={g.id} g={g} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function BarisGalat({ g }: { g: Galat }) {
  const jelas = jelaskanGalat(g.pesan);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium break-words">{g.pesan}</p>
        <p className="mt-0.5 text-muted">
          {LABEL_JENIS[g.jenis ?? ""] ?? g.sumber} · <span className="font-mono text-xs">{g.rute ?? "–"}</span> ·{" "}
          {g.jumlah}× · terakhir {waktuRelatif(g.terakhir_at)}
          {g.jumlah > 1 ? ` (pertama ${tanggalJam(g.pertama_at)})` : ""}
          {g.digest ? (
            <>
              {" "}
              · kode <span className="font-mono text-xs">{g.digest}</span>
            </>
          ) : null}
        </p>
        {jelas && (
          <p className="mt-1.5 rounded-control bg-surface-muted px-3 py-2">
            <span className="font-medium">Artinya:</span> {jelas.arti}{" "}
            <span className="font-medium">Saran:</span> {jelas.saran}
          </p>
        )}
      </div>
      {!g.dicek_at && <TombolAksi aksi={tandaiGalatDicek.bind(null, g.id)} label="Sudah dicek" varian="netral" />}
    </li>
  );
}

type Temuan = {
  kode: string;
  judul: string;
  jumlah: number;
  contoh: string | null;
  saran: string;
  bisa_diperbaiki: boolean;
  tautan: string | null;
};

/** Pemeriksaan kejanggalan data sekali buka (RPC periksa_data). */
async function PemeriksaanData() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("periksa_data");
  if (error) {
    return <Card className="text-sm text-muted">Mohon maaf, pemeriksaan data belum bisa dimuat.</Card>;
  }
  const temuan = (data as Temuan[]).filter((t) => t.jumlah > 0);
  return (
    <Card>
      <h2 className="text-lg font-semibold">Pemeriksaan data</h2>
      <p className="mt-1 text-sm text-muted">
        Diperiksa otomatis setiap halaman ini dibuka: akun, absensi, permintaan, galat, dan data yang janggal.
      </p>
      {temuan.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Alhamdulillah, tidak ada kejanggalan.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {temuan.map((t) => (
            <li key={t.kode} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {t.judul} <span className="text-warning">({t.jumlah})</span>
                </p>
                {t.contoh && <p className="mt-0.5 line-clamp-2 text-muted">{t.contoh}</p>}
                <p className="mt-0.5 text-muted">{t.saran}</p>
              </div>
              <div className="flex gap-2">
                {t.bisa_diperbaiki && (
                  <TombolAksi
                    aksi={perbaikiData.bind(null, t.kode)}
                    label="Perbaiki"
                    varian="kedua"
                    tampilkanPesan
                    konfirmasi={`Perbaiki otomatis: ${t.judul.toLowerCase()}?`}
                  />
                )}
                {t.tautan && (
                  <Link href={t.tautan} className="inline-flex h-9 items-center rounded-pill px-4 text-sm font-medium text-primary hover:bg-primary-soft">
                    Buka
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
