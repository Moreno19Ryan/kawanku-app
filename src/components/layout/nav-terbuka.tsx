import type { ReactNode } from "react";
import { menuJamaahTerbuka } from "@/lib/jamaah/akses";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

/** Menu bersyarat yang terbuka untuk admin ini (dihitung di server). */
async function menuTerbuka(): Promise<string[]> {
  return (await menuJamaahTerbuka()) ? ["/jamaah"] : [];
}

/**
 * Sidebar/BottomNav dengan menu bersyarat. Membaca sesi, jadi harus di dalam
 * <Suspense> (fallback-nya komponen yang sama tanpa `terbuka`).
 */
export async function SidebarTerbuka({ akun }: { akun?: ReactNode }) {
  return <Sidebar akun={akun} terbuka={await menuTerbuka()} />;
}

export async function BottomNavTerbuka() {
  return <BottomNav terbuka={await menuTerbuka()} />;
}
