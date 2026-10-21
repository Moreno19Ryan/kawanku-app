import {
  CalendarCheck,
  LayoutGrid,
  QrCode,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Belum dibangun; tampil non-aktif dengan label "Segera". */
  soon?: boolean;
  /**
   * Dibuka per admin (saklar fitur + izin, dihitung di server); selama
   * belum terbuka tampil seperti "Segera".
   */
  bersyarat?: boolean;
};

/**
 * Menu utama. Item yang tampil per peran akan difilter berdasarkan data hak
 * akses (lihat docs/schema-proposal.md), bukan hardcode per peran.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: LayoutGrid },
  { href: "/jamaah", label: "Jamaah", icon: Users, bersyarat: true },
  { href: "/kegiatan", label: "Kegiatan", icon: CalendarCheck, soon: true },
  { href: "/absensi", label: "Absensi", icon: QrCode, bersyarat: true },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

/** Item non-aktif: belum dibangun, atau bersyarat dan belum terbuka untuk admin ini. */
export function isSegera(item: NavItem, terbuka: string[]) {
  return item.soon || (item.bersyarat && !terbuka.includes(item.href));
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
