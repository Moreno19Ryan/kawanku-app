import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { AbsensiBelumMenyala } from "@/components/absensi/belum-menyala";
import { FormAturUlangPin, FormBuatAkun, FormUsername } from "@/components/absensi/form-akun-generus";
import { PageHeader } from "@/components/layout/page-header";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAksesAbsensi } from "@/lib/absensi/akses";
import {
  aturAkunAktif,
  aturUlangPin,
  buatAkunGenerus,
  buatAkunKelompok,
  hapusAkunGenerus,
  ubahUsername,
} from "@/lib/absensi/akun-actions";
import { usulanUsername } from "@/lib/generus/username";
import { createClient } from "@/lib/supabase/server";
import { jam, waktuRelatif } from "@/lib/waktu";
import { FormOtomatis } from "@/components/ui/form-otomatis";

export const metadata: Metadata = {
  title: "Akun generus",
};

type Cari = { q?: string | string[]; kelompok?: string | string[] };
type Generus = { id: string; kode: string; nama_lengkap: string; nama_panggilan: string | null; tanggal_lahir: string | null };
type Akun = {
  jamaah_id: string;
  username: string;
  aktif: boolean;
  pin_awal: boolean;
  terkunci_sampai: string | null;
  login_terakhir: string | null;
};

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function AkunGenerusPage({ searchParams }: PageProps<"/absensi/akun">) {
  return (
    <>
      <Link href="/absensi" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary lg:mt-10">
        <ArrowLeft className="size-4" aria-hidden />
        Absensi
      </Link>
      <PageHeader
        title="Akun generus"
        description="Akun login generus (username + PIN) untuk absen lewat QR di layar admin."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarAkun cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

async function DaftarAkun({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesAbsensi(), cari]);
  if (!akses || akses.kelompokAkun.length === 0) return <AbsensiBelumMenyala />;

  const pilihan = akses.kelompokAkun;
  const kelompok = pilihan.find((k) => k.id === satu(param.kelompok)) ?? pilihan[0];
  const q = satu(param.q).trim().slice(0, 60).toLowerCase();

  const supabase = await createClient();
  const [{ data: generus }, { data: akun }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select("id, kode, nama_lengkap, nama_panggilan, tanggal_lahir")
      .eq("kelompok_id", kelompok.id)
      .eq("aktif", true)
      .eq("termasuk_generus", true)
      .order("nama_lengkap")
      .returns<Generus[]>(),
    supabase
      .from("akun_generus")
      .select("jamaah_id, username, aktif, pin_awal, terkunci_sampai, login_terakhir")
      .returns<Akun[]>(),
  ]);
  const petaAkun = new Map((akun ?? []).map((a) => [a.jamaah_id, a]));
  const semua = generus ?? [];
  const daftar = semua.filter(
    (g) =>
      !q ||
      g.nama_lengkap.toLowerCase().includes(q) ||
      g.kode.toLowerCase().includes(q) ||
      petaAkun.get(g.id)?.username.includes(q),
  );
  const punya = semua.filter((g) => petaAkun.has(g.id)).length;
  const sekarang = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">{kelompok.nama}</p>
          <p className="text-sm text-muted">
            {punya} dari {semua.length} generus aktif sudah punya akun. PIN awal = tanggal lahir (DDMMYY), wajib
            diganti saat login pertama.
          </p>
        </div>
        <TombolAksi
          aksi={buatAkunKelompok.bind(null, kelompok.id)}
          label="Buat akun yang belum ada"
          tampilkanPesan
          varian="kedua"
          konfirmasi="Buat akun untuk semua generus yang belum punya (tanggal lahir lengkap)? PIN awal = tanggal lahir DDMMYY."
        />
      </Card>

      <FormOtomatis className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama, kode, atau username"
            aria-label="Cari generus"
            className={`${INPUT_CLASS} w-full pl-11`}
          />
        </div>
        {pilihan.length > 1 && (
          <select name="kelompok" defaultValue={kelompok.id} aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:w-48`}>
            {pilihan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        )}
      </FormOtomatis>

      {daftar.length === 0 ? (
        <Card className="text-center text-sm text-muted">Tidak ada generus yang cocok.</Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {daftar.map((g) => {
            const a = petaAkun.get(g.id);
            const adaTanggal = Boolean(g.tanggal_lahir);
            const terkunci = a?.terkunci_sampai && a.terkunci_sampai > sekarang;
            return (
              <li key={g.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{g.nama_lengkap}</span>
                  {a ? (
                    <>
                      <span className="font-mono text-sm text-muted">@{a.username}</span>
                      <Badge nada={a.aktif ? "sukses" : "netral"}>{a.aktif ? "Aktif" : "Nonaktif"}</Badge>
                      {a.pin_awal && <Badge>PIN awal</Badge>}
                      {terkunci && <Badge nada="bahaya">Terkunci s.d. {jam(a.terkunci_sampai!)}</Badge>}
                    </>
                  ) : (
                    <Badge>Belum ada akun</Badge>
                  )}
                </div>
                <p className="-mt-2 text-sm text-muted">
                  {[
                    g.kode,
                    adaTanggal ? null : "tanggal lahir belum lengkap",
                    a ? (a.login_terakhir ? `login ${waktuRelatif(a.login_terakhir)}` : "belum pernah login") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {!a ? (
                  <FormBuatAkun aksi={buatAkunGenerus.bind(null, g.id)} usulan={usulanUsername(g)} adaTanggal={adaTanggal} />
                ) : (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Kelola akun</summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <FormUsername aksi={ubahUsername.bind(null, g.id)} username={a.username} />
                      <FormAturUlangPin aksi={aturUlangPin.bind(null, g.id)} adaTanggal={adaTanggal} />
                      <div className="flex flex-wrap gap-2">
                        <TombolAksi
                          aksi={aturAkunAktif.bind(null, g.id, !a.aktif)}
                          label={a.aktif ? "Nonaktifkan" : "Aktifkan"}
                          varian="kedua"
                        />
                        <TombolAksi
                          aksi={hapusAkunGenerus.bind(null, g.id)}
                          label="Hapus akun"
                          varian="bahaya"
                          konfirmasi={`Hapus akun @${a.username}? ${g.nama_lengkap} tidak bisa login lagi (riwayat absen tetap ada).`}
                        />
                      </div>
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
