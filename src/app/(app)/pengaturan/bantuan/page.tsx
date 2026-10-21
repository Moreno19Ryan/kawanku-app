import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Bantuan",
};

const TANYA_JAWAB = [
  {
    tanya: "Saya lupa kata sandi. Bagaimana?",
    jawab:
      "Hubungi pengelola akunmu: admin desa untuk admin kelompok dan admin generus desa, atau admin kelompokmu untuk admin generus kelompok. Mereka bisa membuat kata sandi sementara dari Pengaturan → Admin & akses. Setelah login, segera ganti di Pengaturan → Akun saya.",
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
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-border">
          {TANYA_JAWAB.map((t) => (
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
        Masalah lain atau menemukan kesalahan data? Hubungi admin desa.
      </p>
    </>
  );
}
