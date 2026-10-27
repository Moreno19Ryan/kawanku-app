import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { FormPengumuman } from "@/components/sistem/form-pengumuman";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { wajibIzin } from "@/lib/auth/admin";
import { hapusPengumuman, ubahStatusPengumuman } from "@/lib/sistem/actions";
import { KOLOM_PENGUMUMAN, type Pengumuman } from "@/lib/sistem/data";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Pengumuman",
};

export default function PengumumanPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Pengumuman"
        description="Banner di atas aplikasi untuk admin, generus, atau keduanya."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <IsiPengumuman />
      </Suspense>
    </>
  );
}

function statusTayang(p: Pengumuman) {
  const sekarang = Date.now();
  if (!p.aktif) return { label: "Disembunyikan", nada: "netral" as const };
  if (new Date(p.mulai).getTime() > sekarang) return { label: "Terjadwal", nada: "utama" as const };
  if (p.berakhir && new Date(p.berakhir).getTime() <= sekarang) {
    return { label: "Berakhir", nada: "netral" as const };
  }
  return { label: "Tayang", nada: "sukses" as const };
}

async function IsiPengumuman() {
  await wajibIzin("pengumuman.kelola");
  const supabase = await createClient();
  const { data: daftar, error } = await supabase
    .from("pengumuman")
    .select(KOLOM_PENGUMUMAN)
    .order("mulai", { ascending: false })
    .limit(50)
    .returns<Pengumuman[]>();

  if (error || !daftar) {
    return <Card className="text-sm text-danger">Mohon maaf, data pengumuman belum berhasil dimuat. Silakan muat ulang halaman.</Card>;
  }
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card>
        <h2 className="mb-5 text-lg font-semibold">Pengumuman baru</h2>
        <FormPengumuman pilihSasaran />
      </Card>

      {daftar.length > 0 && (
        <ul className="flex flex-col gap-3">
          {daftar.map((p) => {
            const status = statusTayang(p);
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge nada={status.nada}>{status.label}</Badge>
                      <Badge>{p.nada === "peringatan" ? "Peringatan" : "Info"}</Badge>
                      <Badge nada={p.sasaran === "admin" ? "netral" : "utama"}>
                        {p.sasaran === "admin" ? "Admin" : p.sasaran === "generus" ? "Generus" : "Admin & generus"}
                        {p.kelompok_id ? " · kelompok" : ""}
                      </Badge>
                    </div>
                    <p className="mt-2">{p.pesan}</p>
                    <p className="mt-1 text-xs text-muted">
                      Mulai {tanggalJam(p.mulai)}
                      {p.berakhir ? ` · berakhir ${tanggalJam(p.berakhir)}` : " · tanpa batas"}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:flex-col sm:items-end">
                    <TombolAksi
                      aksi={ubahStatusPengumuman.bind(null, p.id, !p.aktif)}
                      label={p.aktif ? "Sembunyikan" : "Tayangkan"}
                      varian={p.aktif ? "netral" : "kedua"}
                    />
                    <TombolAksi
                      aksi={hapusPengumuman.bind(null, p.id)}
                      label="Hapus"
                      varian="bahaya"
                      konfirmasi="Hapus pengumuman ini?"
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
