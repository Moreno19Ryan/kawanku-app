import {
  Building2,
  KeyRound,
  Megaphone,
  Palette,
  ShieldCheck,
  Tags,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type BagianPengaturan = {
  href: string;
  judul: string;
  keterangan: string;
  icon: LucideIcon;
  /** Izin global yang dibutuhkan; kosong = semua admin. */
  izin?: string;
  segera?: boolean;
};

/** Daftar bagian Pengaturan. Yang tampil difilter dari izin admin (data). */
export const BAGIAN_PENGATURAN: BagianPengaturan[] = [
  {
    href: "/pengaturan/akun",
    judul: "Akun saya",
    keterangan: "Profil, peran, dan kata sandi",
    icon: UserRound,
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
    keterangan: "Aktifkan admin dan atur perannya",
    icon: ShieldCheck,
    izin: "akses.kelola",
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
    href: "/pengaturan/kategori",
    judul: "Kategori jamaah",
    keterangan: "Aturan pengelompokan jamaah",
    icon: Tags,
    izin: "pengaturan.kelola",
    segera: true,
  },
];
