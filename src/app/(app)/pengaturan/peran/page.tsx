import type { Metadata } from "next";
import { Suspense } from "react";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Card } from "@/components/ui/card";
import { wajibIzin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Peran & izin",
};

type BarisPeran = {
  id: string;
  nama: string;
  wilayah: "desa" | "kelompok" | "fleksibel";
  hanya_generus: boolean;
  deskripsi: string | null;
  peran_izin: { izin_kode: string }[];
};

const LABEL_WILAYAH = {
  desa: "Seluruh desa",
  kelompok: "Satu kelompok",
  fleksibel: "Desa atau satu kelompok",
} as const;

export default function PeranPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Peran & izin"
        description="Hanya dibaca. Detail hak akses masih menunggu keputusan pengurus."
      />
      <Suspense fallback={<Memuat className="h-96" />}>
        <MatriksIzin />
      </Suspense>
    </>
  );
}

async function MatriksIzin() {
  await wajibIzin("akses.kelola");
  const supabase = await createClient();
  const [{ data: peran }, { data: izin }] = await Promise.all([
    supabase
      .from("peran")
      .select("id, nama, wilayah, hanya_generus, deskripsi, peran_izin(izin_kode)")
      .order("nama")
      .returns<BarisPeran[]>(),
    supabase.from("izin").select("kode, deskripsi, hanya_kelompok").order("kode"),
  ]);

  if (!peran || !izin) {
    return <Card className="text-sm text-danger">Mohon maaf, data peran belum berhasil dimuat. Silakan muat ulang halaman.</Card>;
  }

  const punya = new Map(peran.map((p) => [p.id, new Set(p.peran_izin.map((i) => i.izin_kode))]));

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 md:grid-cols-3">
        {peran.map((p) => (
          <li key={p.id}>
            <Card className="h-full">
              <p className="font-semibold">{p.nama}</p>
              <p className="mt-1 text-sm text-muted">{p.deskripsi}</p>
              <p className="mt-3 text-xs text-muted">
                {LABEL_WILAYAH[p.wilayah]}
                {p.hanya_generus && " · hanya jamaah generus"}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-5 py-3 font-medium text-muted">
                Izin
              </th>
              {peran.map((p) => (
                <th key={p.id} scope="col" className="px-3 py-3 text-center font-medium">
                  {p.nama}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {izin.map((i) => (
              <tr key={i.kode}>
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  {i.deskripsi}
                  <span className="block font-mono text-xs text-muted">{i.kode}</span>
                  {i.hanya_kelompok && (
                    <span className="mt-1 block text-xs text-muted">Hanya berlaku di tingkat kelompok</span>
                  )}
                </th>
                {peran.map((p) => (
                  <td key={p.id} className="px-3 py-3 text-center">
                    {punya.get(p.id)?.has(i.kode) ? (
                      <Check className="mx-auto size-5 text-success" aria-label="Ya" />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted/50" aria-label="Tidak" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
