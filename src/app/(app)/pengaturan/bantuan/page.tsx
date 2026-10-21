import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adalahAdminGenerus,
  pengelolaAkun,
  punyaIzin,
  wajibAdmin,
  type AdminSaatIni,
} from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Bantuan",
};

type TanyaJawab = {
  tanya: string;
  jawab: string;
  /** Tampil hanya untuk admin yang cocok; kosong = semua admin. */
  untuk?: (admin: AdminSaatIni) => boolean;
};

const TANYA_JAWAB: TanyaJawab[] = [
  {
    tanya: "Saya lupa kata sandi. Bagaimana?",
    jawab:
      "Hubungi pengelola akunmu (tertulis di Pengaturan → Akun saya). Mereka bisa membuat kata sandi sementara dari Pengaturan → Admin & akses. Setelah login, segera ganti di Pengaturan → Akun saya.",
  },
  {
    tanya: "Kenapa saya hanya melihat sebagian jamaah?",
    jawab:
      "Admin generus hanya melihat jamaah berkategori generus di wilayah tugasnya. Kategori bertanda “sasaranmu” ada di Pengaturan → Kategori jamaah.",
    untuk: adalahAdminGenerus,
  },
  {
    tanya: "Ada jamaah generus yang tiba-tiba hilang dari daftar saya.",
    jawab:
      "Biasanya karena status sekolah atau pernikahannya berubah (mis. sudah menikah), sehingga kategorinya bukan generus lagi. Jamaahnya tidak terhapus; hubungi admin kelompok atau admin desa bila perubahannya keliru.",
    untuk: adalahAdminGenerus,
  },
  {
    tanya: "Bagaimana mengelola akun admin generus kelompok?",
    jawab:
      "Akun admin generus kelompok dikelola admin kelompoknya masing-masing, bukan admin desa. Admin desa mengelola admin kelompok dan admin generus desa.",
    untuk: (admin) => punyaIzin(admin, "akses.kelola"),
  },
  {
    tanya: "Bagaimana mengubah aturan kategori jamaah?",
    jawab:
      "Buka Pengaturan → Kategori jamaah, lalu pilih “Ubah aturan” pada kategori yang ingin diubah. Perubahan langsung berlaku untuk semua jamaah, termasuk jamaah yang terlihat oleh admin generus.",
    untuk: (admin) => punyaIzin(admin, "pengaturan.kelola"),
  },
  {
    tanya: "Kenapa ada menu yang bertuliskan “Segera”?",
    jawab:
      "Fitur itu sedang dibangun atau belum dinyalakan untuk kelompokmu. Menu akan aktif otomatis saat sudah siap.",
  },
  {
    tanya: "Kenapa saya tidak melihat data kelompok lain?",
    jawab:
      "Setiap admin hanya melihat data sesuai wilayah tugasnya. Lihat Pengaturan → Peran & wewenang saya untuk rinciannya.",
    untuk: (admin) => admin.penugasan.every((p) => p.kelompok !== null),
  },
  {
    tanya: "Bagaimana kategori jamaah ditentukan?",
    jawab:
      "Otomatis dari status sekolah, status pernikahan, dan usia (untuk lansia). Lihat aturannya di Pengaturan → Kategori jamaah.",
  },
  {
    tanya: "Muncul halaman “Sedang perawatan”.",
    jawab:
      "Aplikasi sedang diperbarui. Coba lagi beberapa saat lagi; perkiraan selesai biasanya tertulis di halaman itu.",
  },
  {
    tanya: "Saya login di HP orang lain dan lupa keluar.",
    jawab:
      "Buka Pengaturan → Akun saya → Keluar dari semua perangkat, lalu login lagi di perangkatmu sendiri.",
  },
];

export default function BantuanPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader title="Bantuan" description="Pertanyaan yang sering muncul." />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <DaftarBantuan />
      </Suspense>
    </>
  );
}

async function DaftarBantuan() {
  const admin = await wajibAdmin();
  const daftar = TANYA_JAWAB.filter((t) => !t.untuk || t.untuk(admin));

  return (
    <>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-border">
          {daftar.map((t) => (
            <li key={t.tanya}>
              <details className="group px-5 py-4 sm:px-6">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {t.tanya}
                    <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted">{t.jawab}</p>
              </details>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-sm text-muted">
        Masalah lain atau menemukan kesalahan data? Hubungi{" "}
        <span className="font-medium text-fg">{pengelolaAkun(admin)}</span>.
      </p>
    </>
  );
}
