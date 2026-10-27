import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays, Trash2, UserRound, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibAdmin } from "@/lib/auth/admin";
import { hapusPermanenSampah, kembalikanSampah } from "@/lib/sistem/sampah-actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Tempat sampah",
};

type Entri = {
  id: string;
  jenis: "jamaah" | "keluarga" | "kegiatan";
  label: string;
  kelompok_id: string | null;
  jumlah_ikut: number;
  dihapus_oleh: string | null;
  kedaluwarsa_at: string;
  created_at: string;
};

const IKON = { jamaah: UserRound, keluarga: UsersRound, kegiatan: CalendarDays };
const LABEL = { jamaah: "Jamaah", keluarga: "Keluarga", kegiatan: "Kegiatan" };

export default function SampahPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Tempat sampah"
        description="Jamaah, keluarga, dan kegiatan yang dihapus di wilayah tugas. Bisa dikembalikan seperti semula dalam 30 hari, setelah itu terhapus permanen."
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Daftar />
      </Suspense>
    </>
  );
}

function sisaHari(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

async function Daftar() {
  await wajibAdmin();
  const supabase = await createClient();
  const [{ data, error }, { data: kelompok }, { data: admin }] = await Promise.all([
    supabase
      .from("tempat_sampah")
      .select("id, jenis, label, kelompok_id, jumlah_ikut, dihapus_oleh, kedaluwarsa_at, created_at")
      .order("created_at", { ascending: false })
      .returns<Entri[]>(),
    supabase.from("kelompok").select("id, nama").returns<{ id: string; nama: string }[]>(),
    supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
  ]);
  if (error) {
    return <Card className="text-sm text-muted">Tempat sampah belum aktif (migrasi belum diterapkan).</Card>;
  }
  const namaKelompok = new Map((kelompok ?? []).map((k) => [k.id, k.nama]));
  const namaAdmin = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));

  if (!data?.length) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <Trash2 className="size-10 text-muted" aria-hidden />
        <p className="font-semibold">Tempat sampah kosong</p>
        <p className="max-w-md text-sm text-muted">Data yang dihapus di wilayah tugas akan muncul di sini selama 30 hari.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y divide-border">
        {data.map((e) => {
          const Ikon = IKON[e.jenis];
          const sisa = sisaHari(e.kedaluwarsa_at);
          return (
            <li key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-muted">
                <Ikon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {e.label}{" "}
                  <span className="font-normal text-muted">
                    · {LABEL[e.jenis]} · {e.kelompok_id ? (namaKelompok.get(e.kelompok_id) ?? "Kelompok") : "Desa"}
                  </span>
                </p>
                <p className="text-muted">
                  Dihapus {waktuRelatif(e.created_at)}
                  {e.dihapus_oleh ? ` oleh ${namaAdmin.get(e.dihapus_oleh) ?? "admin"}` : ""}
                  {e.jumlah_ikut ? ` · ${e.jumlah_ikut} data terkait ikut tersimpan` : ""} ·{" "}
                  <span className={sisa <= 3 ? "text-danger" : undefined} title={tanggalJam(e.kedaluwarsa_at)}>
                    terhapus permanen {sisa === 0 ? "hari ini" : `${sisa} hari lagi`}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <TombolAksi
                  aksi={kembalikanSampah.bind(null, e.id)}
                  label="Kembalikan"
                  varian="kedua"
                  konfirmasi={`Kembalikan ${e.label} seperti semula?`}
                  tampilkanPesan
                />
                <TombolAksi
                  aksi={hapusPermanenSampah.bind(null, e.id)}
                  label="Hapus permanen"
                  varian="bahaya"
                  konfirmasi={`Hapus ${e.label} secara permanen sekarang? Tidak bisa dibatalkan.`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
