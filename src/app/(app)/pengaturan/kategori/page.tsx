import type { Metadata } from "next";
import { Suspense } from "react";
import { Info, Target, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FormKategori } from "@/components/pengaturan/form-kategori";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { adalahAdminGenerus, punyaIzin, wajibAdmin } from "@/lib/auth/admin";
import { analisisPrioritas, type CatatanPrioritas, type Kombinasi } from "@/lib/jamaah/kategori";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import { hapusKategori, simpanKategori, tambahKategori } from "@/lib/pengaturan/kategori-actions";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Kategori jamaah",
};

type BarisKategori = {
  id: string;
  urutan: number;
  nama: string;
  usia_min: number | null;
  usia_max: number | null;
  status_sekolah_berlaku: string[] | null;
  status_pernikahan_berlaku: string[] | null;
  termasuk_generus: boolean;
};

export default function KategoriPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Kategori jamaah"
        description="Kategori dihitung otomatis dari data jamaah. Urutan pemeriksaan diatur sistem, jadi cukup atur syarat tiap kategori."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <DaftarKategori />
      </Suspense>
    </>
  );
}

function syarat(k: BarisKategori): string[] {
  const hasil: string[] = [];
  if (k.status_sekolah_berlaku?.length) {
    hasil.push(
      `Status sekolah: ${k.status_sekolah_berlaku.map((s) => LABEL_STATUS_SEKOLAH[s] ?? s).join(", ")}`,
    );
  }
  if (k.status_pernikahan_berlaku?.length) {
    hasil.push(
      `Status pernikahan: ${k.status_pernikahan_berlaku.map((s) => LABEL_STATUS_PERNIKAHAN[s] ?? s).join(", ")}`,
    );
  }
  if (k.usia_min !== null && k.usia_max !== null) hasil.push(`Usia ${k.usia_min}–${k.usia_max} tahun`);
  else if (k.usia_min !== null) hasil.push(`Usia ${k.usia_min} tahun ke atas`);
  else if (k.usia_max !== null) hasil.push(`Usia sampai ${k.usia_max} tahun`);
  return hasil;
}

/** "menikah, bekerja, 30 th" */
function contoh(c: Kombinasi): string {
  return `${(LABEL_STATUS_PERNIKAHAN[c.nikah] ?? c.nikah).toLowerCase()}, ${(LABEL_STATUS_SEKOLAH[c.sekolah] ?? c.sekolah).toLowerCase()}, ${c.usia} th`;
}

async function DaftarKategori() {
  const admin = await wajibAdmin();
  const bolehUbah = punyaIzin(admin, "pengaturan.kelola");
  const generus = adalahAdminGenerus(admin);
  const supabase = await createClient();

  const [{ data: kategori }, { data: jamaah }] = await Promise.all([
    supabase
      .from("kategori_jamaah")
      .select(
        "id, urutan, nama, usia_min, usia_max, status_sekolah_berlaku, status_pernikahan_berlaku, termasuk_generus",
      )
      .order("urutan")
      .returns<BarisKategori[]>(),
    // Jumlah jamaah aktif per kategori, sebatas yang boleh dilihat (RLS).
    supabase
      .from("jamaah_dengan_kategori")
      .select("kategori_jamaah_id")
      .eq("aktif", true)
      .returns<{ kategori_jamaah_id: string | null }[]>(),
  ]);

  if (!kategori) {
    return <Card className="text-sm text-danger">Mohon maaf, data kategori belum berhasil dimuat. Silakan muat ulang halaman.</Card>;
  }

  const jumlah = new Map<string | null, number>();
  for (const j of jamaah ?? []) {
    jumlah.set(j.kategori_jamaah_id, (jumlah.get(j.kategori_jamaah_id) ?? 0) + 1);
  }
  const tanpaKategori = jumlah.get(null) ?? 0;
  const sasaran = kategori.filter((k) => k.termasuk_generus).map((k) => k.nama);
  const prioritas = analisisPrioritas(kategori);
  const adaMasalah = [...prioritas.values()].some((c) => c.tidakTerpakai || c.generusMenikah);

  return (
    <div className="flex flex-col gap-3">
      {generus && (
        <Card className="flex gap-4 bg-primary-soft/50">
          <Target className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Jamaah yang diurus</p>
            <p className="mt-1 text-muted">
              Admin generus hanya melihat dan mengurus jamaah berkategori generus
              {sasaran.length > 0 ? `: ${sasaran.join(", ")}` : ""}. Bila status sekolah atau
              pernikahan jamaah berubah sehingga kategorinya bukan generus lagi, jamaah itu
              otomatis keluar dari daftar.
            </p>
          </div>
        </Card>
      )}

      {bolehUbah && (
        <Card className="text-sm text-muted">
          Perubahan aturan langsung berlaku untuk semua jamaah, termasuk siapa saja yang bisa
          dilihat admin generus (saklar <span className="font-medium text-fg">Termasuk generus</span>
          ). Pastikan sesuai keputusan pengurus.
        </Card>
      )}

      <Card className="flex gap-3 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-muted">
          <span className="font-medium text-fg">Urutan pemeriksaan diatur sistem:</span> aturan usia (mis.
          Lansia) dulu, lalu Berkeluarga, lalu kategori lain, lalu kategori generus. Kategori generus selalu
          khusus jamaah yang <span className="font-medium text-fg">belum menikah</span>, sehingga jamaah yang
          sudah menikah tidak mungkin masuk generus.
        </p>
      </Card>

      {bolehUbah && adaMasalah && (
        <div role="alert" className="flex gap-3 rounded-card bg-warning/10 p-5 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            <span className="font-semibold">Urutan atau aturan kategori perlu dicek.</span> Ada kategori yang tidak
            pernah terpakai, atau kategori generus yang bisa memuat jamaah yang sudah menikah. Lihat tanda di bawah;
            betulkan syarat kategori yang ditandai (perubahan yang menimbulkan masalah ini tidak bisa disimpan).
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {kategori.map((k, i) => (
          <li key={k.id}>
            <Card className="flex flex-col gap-4">
              <div className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {k.nama}
                    {k.termasuk_generus && (
                      <Badge nada="utama">{generus ? "Generus · sasaran" : "Generus"}</Badge>
                    )}
                  </p>
                  <ul className="mt-1 text-sm text-muted">
                    {syarat(k).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  {jamaah && (
                    <p className="mt-2 text-xs text-muted">{jumlah.get(k.id) ?? 0} jamaah aktif</p>
                  )}
                  <CatatanUrutan catatan={prioritas.get(k.id)} />
                </div>
              </div>

              {bolehUbah && (
                <details className="group border-t border-border pt-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary marker:hidden">
                    <span className="group-open:hidden">Ubah aturan</span>
                    <span className="hidden group-open:inline">Tutup</span>
                  </summary>
                  <div className="mt-4 flex flex-col gap-5">
                    <FormKategori aksi={simpanKategori.bind(null, k.id)} nilai={k} />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <p className="text-xs text-muted">
                        Jamaah di kategori ini akan pindah ke kategori lain yang cocok, atau
                        menjadi &ldquo;tanpa kategori&rdquo;.
                      </p>
                      <TombolAksi
                        aksi={hapusKategori.bind(null, k.id)}
                        label="Hapus kategori"
                        varian="bahaya"
                        konfirmasi={`Hapus kategori “${k.nama}”? Data jamaah tidak ikut terhapus.`}
                      />
                    </div>
                  </div>
                </details>
              )}
            </Card>
          </li>
        ))}
      </ol>

      <p className="text-sm text-muted">
        Jamaah yang tidak cocok dengan aturan mana pun tampil sebagai &ldquo;tanpa kategori&rdquo;
        {jamaah ? ` (saat ini ${tanpaKategori} jamaah aktif)` : ""}.
        {!bolehUbah && " Aturan kategori diatur oleh admin desa sesuai keputusan pengurus."}
      </p>

      {bolehUbah && (
        <Card className="mt-3">
          <h2 className="text-lg font-semibold">Tambah kategori</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Urutannya diatur sistem. Kategori yang membuat kategori lain tidak terpakai tidak bisa disimpan.
          </p>
          <FormKategori aksi={tambahKategori} labelKirim="Tambah kategori" />
        </Card>
      )}
    </div>
  );
}

/** Peringatan & catatan prioritas satu aturan (dari analisisPrioritas). */
function CatatanUrutan({ catatan }: { catatan?: CatatanPrioritas }) {
  if (!catatan) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5 text-xs">
      {catatan.tidakTerpakai && (
        <p className="flex gap-1.5 font-medium text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Tidak pernah terpakai: semua jamaah yang cocok sudah masuk kategori di atasnya (
          {catatan.kalahDari.map((x) => x.nama).join(", ")}).
        </p>
      )}
      {catatan.generusMenikah && (
        <p className="flex gap-1.5 font-medium text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Jamaah yang sudah menikah bisa masuk kategori generus ini (mis. {contoh(catatan.generusMenikah)}) dan
          terlihat oleh admin generus.
        </p>
      )}
      {!catatan.tidakTerpakai &&
        catatan.kalahDari.map((x) => (
          <p key={x.nama} className="flex gap-1.5 text-muted">
            <Info className="size-4 shrink-0" aria-hidden />
            Yang juga cocok dengan &ldquo;{x.nama}&rdquo; di atasnya masuk &ldquo;{x.nama}&rdquo; (mis. {contoh(x.contoh)}).
          </p>
        ))}
    </div>
  );
}
