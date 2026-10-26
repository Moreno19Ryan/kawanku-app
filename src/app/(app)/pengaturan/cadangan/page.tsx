import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Memuat } from "@/components/ui/memuat";
import { getWilayahCadangan } from "@/lib/cadangan/buat";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Cadangan data",
};

export default function CadanganPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Cadangan data"
        description="Unduh data wilayahmu dalam satu file Excel, untuk arsip pengurus."
      />
      <Suspense fallback={<Memuat className="h-80" />}>
        <IsiCadangan />
      </Suspense>
    </>
  );
}

const LEMBAR = ["Jamaah", "Kontak", "Alamat & orang tua", "Keluarga", "Kegiatan & jadwal", "Absensi"];

async function IsiCadangan() {
  const akses = await getWilayahCadangan();
  if (!akses) redirect("/login");
  if (akses.pilihan.length === 0) {
    return <Card className="text-sm text-muted">Cadangan data hanya untuk admin desa dan admin kelompok.</Card>;
  }
  const supabase = await createClient();
  const { data: riwayat } = await supabase
    .from("unduhan_cadangan")
    .select("id, kelompok_id, ringkasan, created_at")
    .eq("oleh", akses.admin.userId)
    .order("created_at", { ascending: false })
    .limit(10);
  const namaWilayah = new Map(akses.pilihan.map((w) => [w.kelompokId ?? "desa", w.nama]));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex gap-3 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-medium">Isinya data pribadi jamaah. Simpan dengan amanah.</p>
          <p className="mt-1 text-muted">
            File berisi lembar {LEMBAR.join(", ")}. NIK dan No. KK tidak ikut. Setiap unduhan dicatat (siapa, kapan,
            wilayah mana) dan terlihat oleh pengembang. Jangan dibagikan di grup atau disimpan di perangkat umum.
          </p>
        </div>
      </Card>

      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-border">
          {akses.pilihan.map((w) => (
            <li key={w.nilai} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-medium">{w.nama}</p>
                <p className="text-sm text-muted">
                  {w.kelompokId ? "Jamaah, keluarga, kegiatan, dan absensi kelompok ini" : "Semua kelompok dalam satu file"}
                </p>
              </div>
              {/* Tautan biasa (bukan <Link>) supaya tidak di-prefetch: setiap unduhan dicatat. */}
              <a href={`/api/cadangan?wilayah=${w.nilai}`} download className={buttonClass("utama")}>
                <Download className="size-4" aria-hidden />
                Unduh Excel
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="riwayat-unduhan">
        <h2 id="riwayat-unduhan" className="mb-2 px-1 text-sm font-semibold text-muted">
          Unduhanmu
        </h2>
        <Card className="text-sm">
          {riwayat?.length ? (
            <ul className="flex flex-col gap-2">
              {riwayat.map((r) => {
                const ringkas = r.ringkasan as Record<string, number>;
                return (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {namaWilayah.get(r.kelompok_id ?? "desa") ?? "Wilayah lain"} ·{" "}
                      <span className="text-muted">
                        {ringkas.jamaah ?? 0} jamaah, {ringkas.absensi ?? 0} catatan absensi
                      </span>
                    </span>
                    <span className="text-muted">{tanggalJam(r.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Belum pernah mengunduh.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
