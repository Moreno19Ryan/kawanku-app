import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Search } from "lucide-react";
import { FormBuatKeluarga } from "@/components/jamaah/form-keluarga";
import { JamaahBelumMenyala } from "@/components/jamaah/belum-menyala";
import { KembaliKeJamaah } from "@/components/jamaah/kembali";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/ui/input";
import { getAksesJamaah } from "@/lib/jamaah/akses";
import { buatKeluarga } from "@/lib/jamaah/keluarga-actions";
import { createClient } from "@/lib/supabase/server";
import { FormOtomatis } from "@/components/ui/form-otomatis";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Keluarga",
};

type Cari = { q?: string | string[]; kelompok?: string | string[] };
type BarisKeluarga = { id: string; nama: string; kelompok_id: string };
type Anggota = { keluarga_id: string; nama_lengkap: string; hubungan_keluarga: string | null };

export default function KeluargaPage({ searchParams }: PageProps<"/jamaah/keluarga">) {
  return (
    <>
      <KembaliKeJamaah />
      <PageHeader title="Keluarga" description="Kelompokkan jamaah ke dalam keluarga (kepala keluarga, pasangan, anak, …)." />
      <Suspense fallback={<Memuat className="h-96" />}>
        <DaftarKeluarga cari={searchParams as Promise<Cari>} />
      </Suspense>
    </>
  );
}

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function DaftarKeluarga({ cari }: { cari: Promise<Cari> }) {
  const [akses, param] = await Promise.all([getAksesJamaah(), cari]);
  if (!akses || akses.kelompokKeluargaLihat.length === 0) return <JamaahBelumMenyala />;

  const q = satu(param.q).trim().slice(0, 60).toLowerCase();
  const kelompok = satu(param.kelompok);
  const ids = akses.kelompokKeluargaLihat.map((k) => k.id);
  const filterKelompok = ids.includes(kelompok) ? [kelompok] : ids;
  const namaKelompok = new Map(akses.kelompokKeluargaLihat.map((k) => [k.id, k.nama]));

  const supabase = await createClient();
  const [{ data: keluarga }, { data: anggota }] = await Promise.all([
    supabase
      .from("keluarga")
      .select("id, nama, kelompok_id")
      .in("kelompok_id", filterKelompok)
      .order("nama")
      .returns<BarisKeluarga[]>(),
    supabase
      .from("jamaah")
      .select("keluarga_id, nama_lengkap, hubungan_keluarga")
      .in("kelompok_id", filterKelompok)
      .not("keluarga_id", "is", null)
      .returns<Anggota[]>(),
  ]);

  const perKeluarga = new Map<string, Anggota[]>();
  for (const a of anggota ?? []) perKeluarga.set(a.keluarga_id, [...(perKeluarga.get(a.keluarga_id) ?? []), a]);
  const daftar = (keluarga ?? []).filter(
    (k) =>
      !q ||
      k.nama.toLowerCase().includes(q) ||
      (perKeluarga.get(k.id) ?? []).some((a) => a.nama_lengkap.toLowerCase().includes(q)),
  );

  return (
    <div className="flex flex-col gap-4">
      {akses.kelompokKeluargaKelola.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Buat keluarga baru</h2>
          <FormBuatKeluarga aksi={buatKeluarga} kelompok={akses.kelompokKeluargaKelola} />
          <p className="mt-3 text-xs text-muted">
            Bisa juga dari halaman detail jamaah: &ldquo;Buat keluarga dengan jamaah ini sebagai kepala
            keluarga&rdquo;.
          </p>
        </Card>
      )}

      <FormOtomatis className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:p-5">
        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama keluarga atau anggota"
            aria-label="Cari keluarga"
            className={`${INPUT_CLASS} w-full pl-11`}
          />
        </div>
        {akses.kelompokKeluargaLihat.length > 1 && (
          <select name="kelompok" defaultValue={kelompok} aria-label="Kelompok" className={`${INPUT_CLASS} w-full sm:w-48`}>
            <option value="">Semua kelompok</option>
            {akses.kelompokKeluargaLihat.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        )}
      </FormOtomatis>

      <p className="px-1 text-sm text-muted">{daftar.length} keluarga</p>
      {daftar.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          {q ? "Tidak ada keluarga yang cocok." : "Belum ada keluarga."}
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
          {daftar.map((k) => {
            const ang = perKeluarga.get(k.id) ?? [];
            const kepala = ang.find((a) => a.hubungan_keluarga === "kepala_keluarga");
            return (
              <li key={k.id}>
                <Link
                  href={`/jamaah/keluarga/${k.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{k.nama}</span>
                    <span className="block truncate text-sm text-muted">
                      {[
                        `${ang.length} anggota`,
                        kepala ? `Kepala: ${kepala.nama_lengkap}` : "Kepala keluarga belum ditentukan",
                        akses.kelompokKeluargaLihat.length > 1 ? namaKelompok.get(k.kelompok_id) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
