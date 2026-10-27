import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { INPUT_CLASS } from "@/components/ui/input";
import { Memuat } from "@/components/ui/memuat";
import { wajibIzin } from "@/lib/auth/admin";
import { bukaKunciAkun, keluarkanAkun } from "@/lib/sistem/akun-actions";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Bantuan akun",
};

type Akun = {
  user_id: string;
  jenis: "admin" | "generus";
  nama: string;
  login: string;
  aktif: boolean;
  peran: string[] | null;
  kelompok: string | null;
  terakhir_masuk: string | null;
  terkunci_sampai: string | null;
  gagal_login: number | null;
  pin_awal: boolean | null;
  sesi_aktif: number;
  dibuat_at: string;
  bantuan_terakhir: "buka_kunci" | "keluarkan" | null;
  bantuan_terakhir_at: string | null;
};

const LABEL_BANTUAN = { buka_kunci: "Kunci dibuka", keluarkan: "Dikeluarkan dari semua perangkat" } as const;

export default function BantuanAkunPage({ searchParams }: PageProps<"/pengaturan/bantuan-akun">) {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Bantuan akun"
        description="Cari akun admin atau generus untuk melihat keadaannya dan menangani keluhan ringan."
      />
      <Suspense fallback={<Memuat className="h-64" />}>
        <Isi cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  await wajibIzin("sistem.kelola");
  const q = String((await cari).q ?? "").slice(0, 100);
  const supabase = await createClient();
  const { data: hasil, error } = await supabase.rpc("cari_akun", { p_cari: q || null });
  const data = hasil as Akun[] | null;

  return (
    <div className="flex flex-col gap-4">
      <FormOtomatis>
        <label className="relative block">
          <span className="sr-only">Cari akun</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nama, email, username, atau kode jamaah (KW-…)"
            className={`${INPUT_CLASS} w-full pl-12`}
          />
        </label>
      </FormOtomatis>

      <p className="text-sm text-muted">
        {q ? `Hasil untuk "${q}"` : "Akun yang terakhir masuk"} · maksimal 30 akun.
      </p>

      {error ? (
        <Card className="text-sm text-danger">Mohon maaf, daftar akun belum bisa dimuat. Silakan muat ulang halaman.</Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="text-sm text-muted">Tidak ada akun yang cocok.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {(data ?? []).map((a) => (
            <BarisAkun key={a.user_id} a={a} />
          ))}
        </ul>
      )}

      <Card className="text-sm text-muted">
        <h2 className="mb-2 font-semibold text-fg">Panduan singkat</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <span className="font-medium text-fg">Generus terkunci</span> (5x PIN salah): tekan Buka kunci, lalu minta
            generus mencoba lagi.
          </li>
          <li>
            <span className="font-medium text-fg">Generus lupa PIN</span>: admin kelompoknya memakai &ldquo;Kembalikan
            ke PIN awal&rdquo; di <Link href="/absensi/akun" className="text-primary">Absensi → Akun generus</Link>.
          </li>
          <li>
            <span className="font-medium text-fg">Admin lupa kata sandi / akun nonaktif</span>: atur ulang di{" "}
            <Link href="/pengaturan/admin" className="text-primary">Pengaturan → Admin & akses</Link>.
          </li>
          <li>
            <span className="font-medium text-fg">HP hilang / masuk di perangkat orang lain</span>: tekan Keluarkan dari
            semua perangkat. Akun tetap aktif dan bisa masuk lagi dari perangkat sendiri.
          </li>
        </ul>
      </Card>
    </div>
  );
}

/** Kunci 5x PIN salah masih berlaku? */
function masihTerkunci(sampai: string | null): boolean {
  return sampai !== null && new Date(sampai).getTime() > Date.now();
}

function BarisAkun({ a }: { a: Akun }) {
  const terkunci = masihTerkunci(a.terkunci_sampai);
  return (
    <li>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.nama}</span>
            <Badge nada={a.jenis === "admin" ? "utama" : "netral"}>{a.jenis === "admin" ? "Admin" : "Generus"}</Badge>
            {!a.aktif && <Badge nada="bahaya">Nonaktif</Badge>}
            {terkunci && <Badge nada="bahaya">Terkunci</Badge>}
            {a.pin_awal && <Badge>Masih PIN awal</Badge>}
          </p>
          <p className="mt-0.5 break-all text-muted">{a.login}</p>
          <p className="mt-1 text-muted">
            {[a.peran?.join(", "), a.kelompok].filter(Boolean).join(" · ") || "Tingkat desa"}
          </p>
          <p className="mt-1 text-muted">
            {a.terakhir_masuk
              ? `Terakhir masuk ${waktuRelatif(a.terakhir_masuk)} (${tanggalJam(a.terakhir_masuk)})`
              : "Belum pernah masuk"}
            {" · "}
            {a.sesi_aktif > 0 ? `${a.sesi_aktif} perangkat sedang masuk` : "tidak sedang masuk di perangkat mana pun"}
          </p>
          {terkunci && a.terkunci_sampai && (
            <p className="mt-1 text-danger">
              PIN salah 5x. Terkunci sampai {tanggalJam(a.terkunci_sampai)} (terbuka sendiri setelahnya).
            </p>
          )}
          {!terkunci && (a.gagal_login ?? 0) > 0 && (
            <p className="mt-1 text-warning">PIN salah {a.gagal_login}x berturut-turut.</p>
          )}
          {a.bantuan_terakhir && a.bantuan_terakhir_at && !terkunci && (
            <p className="mt-1 text-success">
              {LABEL_BANTUAN[a.bantuan_terakhir]} {waktuRelatif(a.bantuan_terakhir_at)}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {a.jenis === "generus" && (terkunci || (a.gagal_login ?? 0) > 0) && (
            <TombolAksi aksi={bukaKunciAkun.bind(null, a.user_id)} label="Buka kunci" varian="utama" tampilkanPesan />
          )}
          {a.sesi_aktif > 0 && (
            <TombolAksi
              aksi={keluarkanAkun.bind(null, a.user_id)}
              label="Keluarkan dari semua perangkat"
              varian="kedua"
              tampilkanPesan
              konfirmasi={`Keluarkan ${a.nama} dari ${a.sesi_aktif} perangkat? Akun tetap aktif dan bisa masuk lagi.`}
            />
          )}
        </div>
      </Card>
    </li>
  );
}
