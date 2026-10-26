import {
  BadgeCheck,
  Building2,
  CircleHelp,
  KeyRound,
  Megaphone,
  Palette,
  ShieldCheck,
  Tags,
  Trash2,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type BagianPengaturan = {
  href: string;
  judul: string;
  keterangan: string;
  icon: LucideIcon;
  /** Izin global yang dibutuhkan; kosong (dan tanpa izinWilayah) = semua admin. */
  izin?: string;
  /** Alternatif: izin (salah satu) yang cukup berlaku di wilayah mana pun (mis. per kelompok). */
  izinWilayah?: string | string[];
  segera?: boolean;
};

/** Daftar bagian Pengaturan. Yang tampil difilter dari izin admin (data). */
export const BAGIAN_PENGATURAN: BagianPengaturan[] = [
  {
    href: "/pengaturan/akun",
    judul: "Akun saya",
    keterangan: "Profil, kata sandi, dan keamanan sesi",
    icon: UserRound,
  },
  {
    href: "/pengaturan/wewenang",
    judul: "Peran & wewenang saya",
    keterangan: "Wilayah tugas dan apa saja yang boleh kamu lakukan",
    icon: BadgeCheck,
  },
  {
    href: "/pengaturan/tampilan",
    judul: "Tampilan",
    keterangan: "Tema terang, gelap, atau ikut perangkat",
    icon: Palette,
  },
  {
    href: "/pengaturan/admin",
    judul: "Admin & akses",
    keterangan: "Buat dan kelola akun admin sesuai wewenangmu",
    icon: ShieldCheck,
    izin: "akses.kelola",
    izinWilayah: "akses.kelola_generus",
  },
  {
    href: "/pengaturan/kelompok",
    judul: "Kelompok",
    keterangan: "Nama resmi dan status kelompok",
    icon: Building2,
    izin: "kelompok.kelola",
  },
  {
    href: "/pengaturan/peran",
    judul: "Peran & izin",
    keterangan: "Apa saja yang boleh dilakukan tiap peran",
    icon: KeyRound,
    izin: "akses.kelola",
  },
  {
    href: "/pengaturan/kategori",
    judul: "Kategori jamaah",
    keterangan: "Aturan pengelompokan jamaah",
    icon: Tags,
  },
  {
    href: "/pengaturan/pengumuman",
    judul: "Pengumuman",
    keterangan: "Banner informasi untuk semua admin",
    icon: Megaphone,
    izin: "pengumuman.kelola",
  },
  {
    href: "/pengaturan/sistem",
    judul: "Panel pengembang",
    keterangan: "Mode perawatan, saklar fitur, info sistem",
    icon: Wrench,
    izin: "sistem.kelola",
  },
  {
    href: "/pengaturan/sampah",
    judul: "Tempat sampah",
    keterangan: "Jamaah, keluarga, dan kegiatan yang dihapus (bisa dikembalikan 30 hari)",
    icon: Trash2,
    izinWilayah: ["jamaah.hapus", "keluarga.kelola", "kegiatan.kelola"],
  },
  {
    href: "/pengaturan/bantuan",
    judul: "Bantuan",
    keterangan: "Panduan singkat dan kontak",
    icon: CircleHelp,
  },
];
