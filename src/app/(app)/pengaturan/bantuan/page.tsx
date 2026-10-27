import type { Metadata } from "next";
import { Suspense } from "react";
import { KartuKontakPengembang } from "@/components/bantuan/kontak-pengembang";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Card } from "@/components/ui/card";
import {
  adalahAdminGenerus,
  pengelolaAkun,
  punyaIzin,
  wajibAdmin,
  type AdminSaatIni,
} from "@/lib/auth/admin";
import { Memuat } from "@/components/ui/memuat";

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
      "Silakan hubungi pengelola akun (tertulis di Pengaturan → Akun saya). Mereka bisa membuat kata sandi sementara dari Pengaturan → Admin & akses. Setelah login, segera ganti di Pengaturan → Akun saya.",
  },
  {
    tanya: "Kenapa saya hanya melihat sebagian jamaah?",
    jawab:
      "Admin generus hanya melihat jamaah berkategori generus di wilayah tugasnya. Kategori bertanda “sasaran” ada di Pengaturan → Kategori jamaah.",
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
      "Fitur itu sedang dibangun atau belum dinyalakan untuk kelompok tersebut. Menu akan aktif otomatis saat sudah siap.",
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
    tanya: "Aplikasi error, tidak bisa dibuka, atau fiturnya tidak jalan.",
    jawab:
      "Silakan muat ulang halaman terlebih dahulu. Bila masih bermasalah, silakan hubungi pengembang lewat WhatsApp atau email di bawah, dan mohon sertakan nama akun, halaman yang dibuka, serta tangkapan layar.",
  },
  {
    tanya: "Muncul halaman “Sedang perawatan”.",
    jawab:
      "Aplikasi sedang diperbarui. Coba lagi beberapa saat lagi; perkiraan selesai biasanya tertulis di halaman itu.",
  },
  {
    tanya: "Saya login di HP orang lain dan lupa keluar.",
    jawab:
      "Buka Pengaturan → Akun saya → Keluar dari semua perangkat, lalu masuk kembali di perangkat sendiri.",
  },
];

export default function BantuanPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader title="Bantuan" description="Pertanyaan yang sering muncul." />
      <Suspense fallback={<Memuat className="h-80" />}>
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
      <p className="mt-4 mb-6 text-sm text-muted">
        Urusan akun (lupa kata sandi, ganti peran) atau kesalahan data jamaah? Silakan hubungi{" "}
        <span className="font-medium text-fg">{pengelolaAkun(admin)}</span>.
      </p>
      <KartuKontakPengembang />
    </>
  );
}
