import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormKataSandi } from "@/components/pengaturan/form-kata-sandi";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { SaklarNotifikasi } from "@/components/generus/saklar-notifikasi";
import { TombolKeluarSemua } from "@/components/pengaturan/tombol-keluar-semua";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { hapusPerangkatMfa } from "@/lib/auth/actions";
import { labelPenugasan, pengelolaAkun, punyaIzin, wajibAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Akun saya",
};

export default function AkunPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader title="Akun saya" />

      <div className="flex flex-col gap-4 sm:gap-6">
        <Suspense fallback={<Skeleton className="h-36" />}>
          <ProfilAkun />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-36" />}>
          <VerifikasiDuaLangkah />
        </Suspense>

        <SaklarNotifikasi untuk="admin" />

        <Card>
          <h2 className="text-lg font-semibold">Ganti kata sandi</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Mohon masukkan kata sandi lama sebagai pengaman.
          </p>
          <FormKataSandi />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Keamanan sesi</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Pernah login di perangkat orang lain, atau HP hilang? Keluarkan akun ini dari semua
            perangkat sekaligus, lalu masuk kembali di perangkat ini.
          </p>
          <TombolKeluarSemua />
        </Card>
      </div>
    </>
  );
}

async function ProfilAkun() {
  const admin = await wajibAdmin();

  return (
    <Card>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Nama</dt>
          <dd className="mt-0.5 font-medium">{admin.nama}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Email</dt>
          <dd className="mt-0.5 font-medium break-all">{admin.email ?? "–"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Peran</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {admin.penugasan.map((p) => (
              <Badge key={labelPenugasan(p)} nada="utama">
                {labelPenugasan(p)}
              </Badge>
            ))}
          </dd>
        </div>
      </dl>
      <p className="mt-5 text-xs text-muted">
        Nama, peran, dan atur ulang kata sandi dikelola oleh{" "}
        <span className="font-medium text-fg">{pengelolaAkun(admin)}</span>.
      </p>
    </Card>
  );
}

/** Daftar perangkat verifikasi dua langkah (TOTP): tambah & hapus. */
async function VerifikasiDuaLangkah() {
  const admin = await wajibAdmin();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const perangkat = (data?.totp ?? []).filter((f) => f.status === "verified");
  const pengembang = punyaIzin(admin, "sistem.kelola");

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Verifikasi dua langkah</h2>
        {perangkat.length > 0 ? <Badge nada="sukses">Aktif</Badge> : <Badge>Belum aktif</Badge>}
      </div>
      <p className="mt-1 mb-4 text-sm text-muted">
        Selain kata sandi, setiap masuk diminta kode 6 angka dari aplikasi authenticator di HP.
        {pengembang
          ? " Wajib untuk akun pengembang. Sebaiknya daftarkan dua perangkat supaya tetap bisa masuk bila satu HP hilang."
          : " Tidak wajib, tapi sangat dianjurkan."}
      </p>
      {perangkat.length > 0 && (
        <ul className="mb-4 divide-y divide-border">
          {perangkat.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{f.friendly_name ?? "Aplikasi authenticator"}</p>
                <p className="text-muted">Didaftarkan {tanggalJam(f.created_at)}</p>
              </div>
              {(!pengembang || perangkat.length > 1) && (
                <TombolAksi
                  aksi={hapusPerangkatMfa.bind(null, f.id)}
                  label="Hapus"
                  varian="netral"
                  konfirmasi="Hapus perangkat ini? Kodenya tidak bisa dipakai lagi untuk masuk."
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/mfa/daftar" className={buttonClass(perangkat.length > 0 ? "kedua" : "utama")}>
        {perangkat.length > 0 ? "Tambah perangkat" : "Aktifkan"}
      </Link>
    </Card>
  );
}
