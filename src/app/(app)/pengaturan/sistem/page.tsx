import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { FormFitur } from "@/components/sistem/form-fitur";
import { FormPerawatan } from "@/components/sistem/form-perawatan";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";
import { simpanFitur } from "@/lib/sistem/actions";
import { getFitur } from "@/lib/sistem/data";
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
        Tabel panel pengembang belum ada di database. Migrasi
        <code className="mx-1">20261021090000_panel_pengembang</code> belum diterapkan.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
          Nyalakan modul per kelompok, mis. Jamaah untuk Kelompok 1 dulu. Modul yang belum selesai
          dibangun tetap tampil &ldquo;Segera&rdquo; walau dinyalakan.
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
