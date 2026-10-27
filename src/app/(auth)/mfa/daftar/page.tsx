import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DaftarMfa } from "@/components/auth/daftar-mfa";
import { HalamanMfa } from "@/components/auth/halaman-mfa";
import { Skeleton } from "@/components/ui/skeleton";
import { bacaAdmin, punyaIzin } from "@/lib/auth/admin";
import { keadaanMfa } from "@/lib/auth/mfa";
import { tujuanAman } from "@/lib/auth/tujuan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Aktifkan verifikasi dua langkah",
};

/**
 * Mendaftarkan aplikasi authenticator. Wajib untuk akun pengembang (dialihkan
 * ke sini oleh wajibAdmin); admin lain boleh memakainya dari Akun saya.
 */
export default function DaftarMfaPage({ searchParams }: PageProps<"/mfa/daftar">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
      <Isi cari={searchParams} />
    </Suspense>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const tujuan = tujuanAman((await cari).next ?? "/pengaturan/akun");
  const supabase = await createClient();
  const mfa = await keadaanMfa(supabase);
  // Menambah perangkat kedua butuh sesi yang sudah memasukkan kode.
  if (mfa.perluKode) redirect(`/mfa?next=${encodeURIComponent("/mfa/daftar")}`);
  const admin = await bacaAdmin(supabase);
  if (!admin) redirect("/login");
  const wajib = punyaIzin(admin, "sistem.kelola") && !mfa.punyaMfa;

  return (
    <HalamanMfa
      judul={mfa.punyaMfa ? "Tambah perangkat verifikasi" : "Aktifkan verifikasi dua langkah"}
      keterangan={
        wajib
          ? "Akun pengembang memegang kendali seluruh aplikasi, jadi wajib dilindungi kode 6 angka dari aplikasi authenticator, selain kata sandi."
          : "Selain kata sandi, setiap masuk akan diminta kode 6 angka dari aplikasi authenticator."
      }
    >
      <DaftarMfa tujuan={wajib ? "/pengaturan/sistem" : tujuan} />
    </HalamanMfa>
  );
}
