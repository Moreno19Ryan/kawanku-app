import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Panduan perbaikan",
};

type Langkah = { teks: string; tautan?: { href: string; label: string } };
type Kasus = { judul: string; tanda: string; langkah: Langkah[]; bila?: string };

/** Panduan perbaikan masalah ringan, memakai alat yang ada di akun pengembang. */
const KASUS: { bagian: string; kasus: Kasus[] }[] = [
  {
    bagian: "Akun & masuk",
    kasus: [
      {
        judul: "Generus tidak bisa masuk (PIN terkunci)",
        tanda: "Generus mengaku PIN benar tapi ditolak, atau muncul pesan terlalu banyak percobaan.",
        langkah: [
          { teks: "Cari akunnya.", tautan: { href: "/pengaturan/bantuan-akun", label: "Bantuan akun" } },
          { teks: "Bila tertulis Terkunci, tekan Buka kunci, lalu minta generus mencoba lagi." },
          { teks: "Bila lupa PIN, admin kelompoknya memakai Kembalikan ke PIN awal.", tautan: { href: "/absensi/akun", label: "Akun generus" } },
        ],
      },
      {
        judul: "Admin lupa kata sandi atau akunnya nonaktif",
        tanda: "Admin tidak bisa masuk dengan email & kata sandinya.",
        langkah: [
          { teks: "Buka daftar admin, cari akunnya.", tautan: { href: "/pengaturan/admin", label: "Admin & akses" } },
          { teks: "Atur ulang kata sandi (kata sandi sementara tampil sekali), atau aktifkan kembali akunnya." },
        ],
      },
      {
        judul: "HP hilang atau akun dipakai di perangkat orang lain",
        tanda: "Ada laporan akun masih terbuka di perangkat yang tidak dikenal.",
        langkah: [
          { teks: "Cari akunnya, lalu tekan Keluarkan dari semua perangkat.", tautan: { href: "/pengaturan/bantuan-akun", label: "Bantuan akun" } },
          { teks: "Untuk admin, sarankan juga mengganti kata sandi setelah masuk lagi." },
        ],
      },
      {
        judul: "HP authenticator pengembang hilang",
        tanda: "Tidak bisa memasukkan kode 6 angka saat masuk.",
        langkah: [
          { teks: "Bila punya HP cadangan yang sudah didaftarkan, pakai kode dari HP itu, lalu hapus perangkat lama di Akun saya." },
          { teks: "Bila tidak ada sama sekali: pemilik project Supabase menjalankan SQL pemulihan di docs/mfa.md, lalu daftar ulang saat masuk." },
        ],
      },
    ],
  },
  {
    bagian: "Absensi & notifikasi",
    kasus: [
      {
        judul: "Absensi pertemuan tidak terbuka",
        tanda: "Pertemuan sudah masuk waktunya, tapi QR/scan menolak atau sesi belum ada.",
        langkah: [
          { teks: "Lihat Kesehatan sistem & Tugas otomatis. Bila Buka absensi gagal atau dimatikan, nyalakan lalu tekan Jalankan sekarang.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
          { teks: "Pastikan saklar fitur Absensi menyala untuk kelompok tersebut dan kegiatannya aktif." },
          { teks: "Bila pertemuan dibatalkan/libur di Kegiatan, absensinya memang tidak dibuka." },
        ],
      },
      {
        judul: "Notifikasi HP tidak sampai",
        tanda: "Pengingat pengajian atau ringkasan pagi tidak muncul.",
        langkah: [
          { teks: "Lihat butir Notifikasi HP di Kesehatan sistem. Bila ada pengiriman gagal, periksa env NOTIFIKASI_RAHASIA & kunci VAPID di Vercel.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
          { teks: "Minta pengguna mematikan lalu menyalakan lagi notifikasi di perangkatnya (Akun saya / Profil generus)." },
          { teks: "Di iPhone, KawanKu harus dipasang ke layar utama dulu." },
        ],
      },
    ],
  },
  {
    bagian: "Data",
    kasus: [
      {
        judul: "Ada laporan data jamaah berubah sendiri",
        tanda: "Admin/jamaah merasa datanya berubah tanpa tahu siapa yang mengubah.",
        langkah: [
          { teks: "Buka Jejak aktivitas dan cari nama jamaahnya (atau buka dari halaman detail jamaah).", tautan: { href: "/pengaturan/jejak", label: "Jejak aktivitas" } },
          { teks: "Lihat siapa, kapan, dan bagian apa yang berubah. Isinya bisa dikembalikan oleh admin kelompoknya." },
        ],
      },
      {
        judul: "Data terhapus tidak sengaja",
        tanda: "Jamaah, keluarga, atau kegiatan hilang.",
        langkah: [
          { teks: "Kurang dari 30 hari: kembalikan dari Tempat sampah.", tautan: { href: "/pengaturan/sampah", label: "Tempat sampah" } },
          { teks: "Lebih lama atau data lain: pulihkan per baris dari cadangan.", tautan: { href: "/pengaturan/cadangan", label: "Cadangan data" } },
        ],
      },
      {
        judul: "Data janggal (akun generus yang sudah tidak berlaku, keluarga kosong, dan sebagainya)",
        tanda: "Kartu Pemeriksaan data di Panel pengembang menunjukkan temuan.",
        langkah: [
          { teks: "Baca saran di tiap temuan. Yang aman bisa langsung ditekan Perbaiki; selainnya buka halamannya.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
        ],
      },
    ],
  },
  {
    bagian: "Sistem",
    kasus: [
      {
        judul: "Perlu memperbaiki sesuatu tanpa diganggu pengguna",
        tanda: "Perbaikan data besar atau pembaruan yang berisiko.",
        langkah: [
          { teks: "Nyalakan Mode perawatan dengan pesan & perkiraan selesai. Pengembang tetap bisa bekerja.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
          { teks: "Matikan lagi setelah selesai." },
        ],
      },
      {
        judul: "Muncul galat baru",
        tanda: "Notifikasi “Ada galat baru di KawanKu” atau angka galat di Kesehatan sistem.",
        langkah: [
          { teks: "Buka Pemantau galat. Baca bagian Artinya & Saran di bawah pesan galat.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
          { teks: "Bila sudah ditangani atau tidak terulang, tandai Sudah dicek." },
        ],
        bila: "Galat yang disebut bug aplikasi: catat halaman & waktunya, lalu sampaikan ke Claude.",
      },
      {
        judul: "Ruang database hampir penuh",
        tanda: "Butir Ruang database berwarna kuning/merah.",
        langkah: [
          { teks: "Kurangi jumlah cadangan yang disimpan per jenis.", tautan: { href: "/pengaturan/cadangan", label: "Cadangan data" } },
          { teks: "Jalankan tugas Bersihkan riwayat sekarang.", tautan: { href: "/pengaturan/sistem", label: "Panel pengembang" } },
        ],
        bila: "Bila tetap penuh, pertimbangkan menaikkan paket Supabase.",
      },
    ],
  },
];

export default function PanduanPengembangPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Panduan perbaikan"
        description="Langkah singkat untuk masalah ringan yang sering terjadi. Bila langkahnya sudah dicoba dan masih bermasalah, sampaikan ke Claude."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Isi />
      </Suspense>
    </>
  );
}

async function Isi() {
  await wajibIzin("sistem.kelola");
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {KASUS.map((b) => (
        <Card key={b.bagian} className="p-0">
          <h2 className="px-5 pt-5 text-lg font-semibold">{b.bagian}</h2>
          <ul className="mt-2 divide-y divide-border">
            {b.kasus.map((k) => (
              <li key={k.judul}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {k.judul}
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-2 text-sm text-muted">Tandanya: {k.tanda}</p>
                  <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                    {k.langkah.map((l) => (
                      <li key={l.teks}>
                        {l.teks}{" "}
                        {l.tautan && (
                          <Link href={l.tautan.href} className="font-medium text-primary">
                            {l.tautan.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                  {k.bila && <p className="mt-2 text-sm text-muted">{k.bila}</p>}
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
