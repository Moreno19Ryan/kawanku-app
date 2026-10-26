import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SaklarNotifikasi } from "@/components/generus/saklar-notifikasi";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { FormJadwalCadangan, type JadwalCadangan } from "@/components/sistem/form-jadwal-cadangan";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { INPUT_CLASS } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";
import { cadangkanSekarang, periksaCadangan, pulihkanBaris } from "@/lib/sistem/cadangan-actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Cadangan data",
};

const BATAS_FREE = 500 * 1024 * 1024;
const LABEL_JENIS: Record<string, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
  tahunan: "Tahunan",
  manual: "Manual",
};

type Cadangan = {
  id: string;
  jenis: string;
  status: "berjalan" | "berhasil" | "gagal";
  ukuran_byte: number | null;
  jumlah_tabel: number | null;
  jumlah_baris: number | null;
  pesan: string | null;
  created_at: string;
  diperiksa_at: string | null;
  hasil_periksa: "cocok" | "rusak" | null;
};

type Cari = { c?: string; t?: string; q?: string };

function ukuran(byte: number | null): string {
  if (byte == null) return "–";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

export default function CadanganPage({ searchParams }: PageProps<"/pengaturan/cadangan">) {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Cadangan data"
        description="Khusus pengembang. Cadangan otomatis terenkripsi untuk memulihkan data yang salah ubah atau terhapus."
      />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Isi cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

async function Isi({ cari }: { cari: Promise<Cari> }) {
  await wajibIzin("sistem.kelola");
  const param = await cari;
  const supabase = await createClient();
  const [{ data: jadwal, error }, { data: daftar }, { data: ruang }, { data: riwayat }, { data: admin }] =
    await Promise.all([
      supabase.from("cadangan_jadwal").select("jenis, aktif, simpan").order("urutan").returns<JadwalCadangan[]>(),
      supabase
        .from("cadangan")
        .select("id, jenis, status, ukuran_byte, jumlah_tabel, jumlah_baris, pesan, created_at, diperiksa_at, hasil_periksa")
        .order("created_at", { ascending: false })
        .returns<Cadangan[]>(),
      supabase.rpc("ukuran_database"),
      supabase
        .from("pemulihan_cadangan")
        .select("id, tabel, baris_id, oleh, created_at")
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<{ id: string; tabel: string; baris_id: string; oleh: string | null; created_at: string }[]>(),
      supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
    ]);

  if (error || !jadwal) {
    return (
      <Card className="text-sm text-danger">
        Tabel cadangan belum ada. Migrasi <code>20261029090000_cadangan_otomatis</code> belum diterapkan.
      </Card>
    );
  }

  const semua = daftar ?? [];
  const terakhir = semua.find((c) => c.status === "berhasil");
  const terpakai = typeof ruang === "number" ? ruang : null;
  const persen = terpakai ? Math.min(100, Math.round((terpakai / BATAS_FREE) * 100)) : null;
  const nama = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));
  const dipilih = semua.find((c) => c.id === param.c && c.status === "berhasil");

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Cadangan terakhir</p>
            <p className="font-semibold">
              {terakhir ? `${LABEL_JENIS[terakhir.jenis]} · ${waktuRelatif(terakhir.created_at)}` : "Belum ada"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Jumlah cadangan</p>
            <p className="font-semibold">
              {semua.filter((c) => c.status === "berhasil").length} tersimpan ·{" "}
              {ukuran(semua.reduce((n, c) => n + (c.ukuran_byte ?? 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Ruang database (paket Free 500 MB)</p>
            <p className="font-semibold">
              {ukuran(terpakai)} {persen != null && <span className="font-normal text-muted">({persen}%)</span>}
            </p>
            {persen != null && (
              <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface-muted" aria-hidden>
                <div
                  className={`h-full rounded-pill ${persen >= 80 ? "bg-danger" : "bg-primary"}`}
                  style={{ width: `${Math.max(persen, 2)}%` }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TombolAksi aksi={cadangkanSekarang} label="Cadangkan sekarang" varian="utama" tampilkanPesan />
          <p className="text-sm text-muted">Disarankan sebelum perubahan besar (impor data, migrasi, kenaikan kelas).</p>
        </div>
      </Card>

      <SaklarNotifikasi untuk="pengembang" />

      <Card>
        <h2 className="text-lg font-semibold">Jadwal otomatis</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Lapis 1: disimpan terenkripsi di database. Yang lebih lama dari jumlah simpan dihapus otomatis (rotasi).
        </p>
        <FormJadwalCadangan jadwal={jadwal} />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Lapis 2: di luar Supabase</h2>
        <p className="mt-1 text-sm text-muted">
          Setiap Ahad pukul 03.00 WIB, GitHub Actions (alur <code>Cadangan mingguan</code>) membuat salinan lengkap database,
          mengenkripsinya dengan sandi pengembang, lalu menyimpannya 90 hari. Ini satu-satunya jalan pulih bila project
          Supabase hilang. Status dan unduhannya ada di tab <strong>Actions</strong> repo; cara memulihkan ada di{" "}
          <code>docs/cadangan.md</code>.
        </p>
      </Card>

      <Card className="overflow-x-auto p-0 sm:p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold sm:px-6 sm:pt-6">Daftar cadangan</h2>
        {semua.length === 0 ? (
          <p className="p-5 text-sm text-muted sm:p-6">Belum ada cadangan. Tekan &ldquo;Cadangkan sekarang&rdquo;.</p>
        ) : (
          <table className="mt-3 w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-muted">
                <th className="px-5 py-2 font-medium sm:px-6">Waktu</th>
                <th className="px-3 py-2 font-medium">Jenis</th>
                <th className="px-3 py-2 font-medium">Isi</th>
                <th className="px-3 py-2 font-medium">Pemeriksaan</th>
                <th className="px-5 py-2 sm:px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {semua.map((c) => (
                <tr key={c.id} className={c.id === dipilih?.id ? "bg-primary-soft/50" : undefined}>
                  <td className="px-5 py-2.5 sm:px-6">
                    {tanggalJam(c.created_at)}
                    <span className="block text-xs text-muted">{waktuRelatif(c.created_at)}</span>
                  </td>
                  <td className="px-3 py-2.5">{LABEL_JENIS[c.jenis] ?? c.jenis}</td>
                  <td className="px-3 py-2.5">
                    {c.status === "berhasil" ? (
                      <>
                        {c.jumlah_baris?.toLocaleString("id-ID")} baris · {c.jumlah_tabel} tabel
                        <span className="block text-xs text-muted">{ukuran(c.ukuran_byte)}</span>
                      </>
                    ) : c.status === "gagal" ? (
                      <span className="text-danger" title={c.pesan ?? undefined}>
                        Gagal{c.pesan ? `: ${c.pesan.slice(0, 60)}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted">Sedang berjalan…</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.hasil_periksa === "cocok" ? (
                      <Badge nada="sukses">Utuh · {waktuRelatif(c.diperiksa_at!)}</Badge>
                    ) : c.hasil_periksa === "rusak" ? (
                      <Badge nada="bahaya">Rusak</Badge>
                    ) : (
                      <span className="text-muted">Belum</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 sm:px-6">
                    {c.status === "berhasil" && (
                      <div className="flex justify-end gap-2">
                        <TombolAksi aksi={periksaCadangan.bind(null, c.id)} label="Periksa" varian="netral" tampilkanPesan />
                        <Link
                          href={`?c=${c.id}#pulihkan`}
                          scroll={false}
                          className="inline-flex h-11 items-center rounded-pill px-4 font-semibold text-primary hover:bg-primary-soft"
                        >
                          Buka
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dipilih && (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Pulihkan cadangan={dipilih} tabel={param.t} cari={param.q ?? ""} />
        </Suspense>
      )}

      {(riwayat ?? []).length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">Riwayat pemulihan</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {(riwayat ?? []).map((r) => (
              <li key={r.id}>
                {tanggalJam(r.created_at)}: {nama.get(r.oleh ?? "") ?? "Pengembang"} memulihkan{" "}
                <span className="font-mono text-xs">
                  {r.tabel}/{r.baris_id.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type BarisCadangan = { baris_id: string; di_cadangan: Record<string, unknown>; sekarang: Record<string, unknown> | null };

/** Pilih tabel → cari baris → bandingkan dengan data sekarang → pulihkan. */
async function Pulihkan({ cadangan, tabel, cari }: { cadangan: Cadangan; tabel?: string; cari: string }) {
  const supabase = await createClient();
  const { data: daftarTabel } = await supabase.rpc("tabel_dalam_cadangan", { p_id: cadangan.id });
  const pilihan = ((daftarTabel ?? []) as { tabel: string; jumlah: number; bisa_dipulihkan: boolean }[]).filter(
    (t) => t.bisa_dipulihkan,
  );
  const aktif = pilihan.find((t) => t.tabel === tabel) ? tabel : undefined;
  const baris = aktif
    ? (((await supabase.rpc("cari_di_cadangan", { p_id: cadangan.id, p_tabel: aktif, p_cari: cari })).data ??
        []) as BarisCadangan[])
    : null;

  return (
    <Card id="pulihkan" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Pulihkan dari cadangan {tanggalJam(cadangan.created_at)}</h2>
        <p className="mt-1 text-sm text-muted">
          Pilih tabel lalu cari barisnya. Memulihkan menimpa baris sekarang (atau mengembalikannya bila sudah terhapus);
          baris lain tidak berubah. Setiap pemulihan tercatat.
        </p>
      </div>
      <FormOtomatis className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="c" value={cadangan.id} />
        <select name="t" defaultValue={aktif ?? ""} aria-label="Tabel" className={`${INPUT_CLASS} sm:w-64`} required>
          <option value="" disabled>
            Pilih tabel…
          </option>
          {pilihan.map((t) => (
            <option key={t.tabel} value={t.tabel}>
              {t.tabel} ({t.jumlah})
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={cari}
          placeholder="Cari nama, kode, atau isi lain…"
          aria-label="Cari di cadangan"
          className={`${INPUT_CLASS} sm:flex-1`}
        />
      </FormOtomatis>

      {aktif && (baris ?? []).length === 0 && <p className="text-sm text-muted">Tidak ada baris yang cocok.</p>}
      <ul className="flex flex-col gap-3">
        {(baris ?? []).map((b) => {
          const beda = Object.keys(b.di_cadangan).filter(
            (k) => k !== "updated_at" && JSON.stringify(b.di_cadangan[k]) !== JSON.stringify(b.sekarang?.[k]),
          );
          const label = String(b.di_cadangan.nama_lengkap ?? b.di_cadangan.nama ?? b.di_cadangan.kode ?? b.baris_id);
          return (
            <li key={b.baris_id} className="rounded-control border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {label}{" "}
                  {!b.sekarang ? (
                    <Badge nada="bahaya">Sudah terhapus</Badge>
                  ) : beda.length === 0 ? (
                    <Badge>Sama dengan sekarang</Badge>
                  ) : (
                    <Badge nada="utama">{beda.length} kolom berbeda</Badge>
                  )}
                </p>
                {(!b.sekarang || beda.length > 0) && (
                  <TombolAksi
                    aksi={pulihkanBaris.bind(null, cadangan.id, aktif!, b.baris_id)}
                    label={b.sekarang ? "Pulihkan" : "Kembalikan"}
                    varian="kedua"
                    konfirmasi={`Pulihkan "${label}" ke kondisi ${tanggalJam(cadangan.created_at)}? Data sekarang pada baris ini ditimpa.`}
                    tampilkanPesan
                  />
                )}
              </div>
              {b.sekarang && beda.length > 0 && (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr_1fr]">
                  <dt className="font-medium text-muted">Kolom</dt>
                  <dd className="font-medium text-muted">Sekarang</dd>
                  <dd className="font-medium text-muted">Di cadangan</dd>
                  {beda.map((k) => (
                    <div key={k} className="contents">
                      <dt className="font-mono">{k}</dt>
                      <dd className="break-all text-danger">{JSON.stringify(b.sekarang?.[k] ?? null)}</dd>
                      <dd className="break-all text-success">{JSON.stringify(b.di_cadangan[k] ?? null)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
