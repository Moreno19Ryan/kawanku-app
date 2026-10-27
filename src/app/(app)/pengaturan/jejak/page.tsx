import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { INPUT_CLASS } from "@/components/ui/input";
import { Memuat } from "@/components/ui/memuat";
import { wajibIzin } from "@/lib/auth/admin";
import { KELOMPOK_TABEL, NAMA_AKSI, namaKolom, namaTabel, sejakHari } from "@/lib/sistem/jejak";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Jejak aktivitas",
};

type Jejak = {
  id: string;
  tabel: string;
  aksi: "insert" | "update" | "delete";
  jamaah_id: string | null;
  label: string | null;
  kolom: string[] | null;
  oleh: string | null;
  created_at: string;
};

const PILIHAN_HARI = [1, 7, 30, 180];
const NADA_AKSI = { insert: "sukses", update: "utama", delete: "bahaya" } as const;

export default function JejakPage({ searchParams }: PageProps<"/pengaturan/jejak">) {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Jejak aktivitas"
        description="Siapa mengubah data apa dan kapan. Yang dicatat hanya nama kolom yang berubah, bukan isinya."
      />
      <Suspense fallback={<Memuat className="h-64" />}>
        <Isi cari={searchParams} />
      </Suspense>
    </>
  );
}

async function Isi({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  await wajibIzin("sistem.kelola");
  const p = await cari;
  const q = String(p.q ?? "").trim().slice(0, 100);
  const bagian = String(p.bagian ?? "");
  const hari = PILIHAN_HARI.includes(Number(p.hari)) ? Number(p.hari) : 7;
  const jamaah = String(p.jamaah ?? "");

  const supabase = await createClient();
  let kueri = supabase
    .from("jejak_aktivitas")
    .select("id, tabel, aksi, jamaah_id, label, kolom, oleh, created_at")
    .gte("created_at", sejakHari(hari))
    .order("created_at", { ascending: false })
    .limit(200);
  if (KELOMPOK_TABEL[bagian]) kueri = kueri.in("tabel", KELOMPOK_TABEL[bagian].tabel);
  if (q) kueri = kueri.ilike("label", `%${q.replaceAll("%", "")}%`);
  if (/^[0-9a-f-]{36}$/.test(jamaah)) kueri = kueri.eq("jamaah_id", jamaah);

  const [{ data, error }, { data: admin }] = await Promise.all([
    kueri.returns<Jejak[]>(),
    supabase.from("admin").select("user_id, nama").returns<{ user_id: string; nama: string }[]>(),
  ]);
  const nama = new Map((admin ?? []).map((a) => [a.user_id, a.nama]));

  return (
    <div className="flex flex-col gap-4">
      <FormOtomatis className="flex flex-col gap-2 sm:flex-row">
        <label className="relative sm:flex-1">
          <span className="sr-only">Cari nama</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama jamaah, kegiatan, atau akun"
            className={`${INPUT_CLASS} w-full pl-12`}
          />
        </label>
        <select name="bagian" defaultValue={bagian} aria-label="Bagian" className={`${INPUT_CLASS} sm:w-52`}>
          <option value="">Semua bagian</option>
          {Object.entries(KELOMPOK_TABEL).map(([kode, k]) => (
            <option key={kode} value={kode}>
              {k.judul}
            </option>
          ))}
        </select>
        <select name="hari" defaultValue={String(hari)} aria-label="Rentang waktu" className={`${INPUT_CLASS} sm:w-44`}>
          {PILIHAN_HARI.map((h) => (
            <option key={h} value={h}>
              {h === 1 ? "24 jam terakhir" : `${h} hari terakhir`}
            </option>
          ))}
        </select>
        {jamaah && <input type="hidden" name="jamaah" value={jamaah} />}
      </FormOtomatis>

      {jamaah && (
        <p className="text-sm text-muted">
          Hanya jejak satu jamaah.{" "}
          <Link href="/pengaturan/jejak" className="text-primary">
            Tampilkan semua
          </Link>
        </p>
      )}

      {error ? (
        <Card className="text-sm text-danger">Mohon maaf, jejak aktivitas belum bisa dimuat. Silakan muat ulang halaman.</Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="text-sm text-muted">Belum ada aktivitas yang cocok.</Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {(data ?? []).map((j) => (
              <li key={j.id} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-start sm:gap-4">
                <div className="w-40 shrink-0 text-muted" title={tanggalJam(j.created_at)}>
                  {waktuRelatif(j.created_at)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge nada={NADA_AKSI[j.aksi]}>{NAMA_AKSI[j.aksi]}</Badge>
                    <span className="font-medium">{namaTabel(j.tabel)}</span>
                    {j.label &&
                      (j.jamaah_id ? (
                        <Link href={`/pengaturan/jejak?jamaah=${j.jamaah_id}&hari=180`} className="text-primary">
                          {j.label}
                        </Link>
                      ) : (
                        <span className="text-muted">{j.label}</span>
                      ))}
                  </p>
                  {j.kolom && j.kolom.length > 0 && (
                    <p className="mt-0.5 text-muted">Yang berubah: {j.kolom.map(namaKolom).join(", ")}</p>
                  )}
                </div>
                <div className="shrink-0 text-muted sm:text-right">
                  oleh{" "}
                  <span className="font-medium text-fg">{j.oleh ? (nama.get(j.oleh) ?? "Generus/akun lain") : "Sistem"}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">Maksimal 200 baris terbaru. Jejak disimpan 180 hari.</p>
    </div>
  );
}
