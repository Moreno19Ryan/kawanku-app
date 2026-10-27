import type { Metadata } from "next";
import { Suspense } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pengelolaAkun, wajibAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Peran & wewenang saya",
};

type BarisPenugasan = {
  id: string;
  peran: {
    nama: string;
    deskripsi: string | null;
    hanya_generus: boolean;
    peran_izin: { izin_kode: string; izin: { deskripsi: string } | null }[];
  } | null;
  kelompok: { nama: string } | null;
};

export default function WewenangPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Peran & wewenang saya"
        description="Wilayah tugas dan apa saja yang bisa dilakukan akun ini di KawanKu."
      />
      <Suspense fallback={<Memuat className="h-80" />}>
        <DaftarWewenang />
      </Suspense>
    </>
  );
}

async function DaftarWewenang() {
  const admin = await wajibAdmin();
  const supabase = await createClient();
  const [{ data: penugasan }, { data: kategoriGenerus }] = await Promise.all([
    supabase
      .from("penugasan_peran")
      .select(
        "id, peran(nama, deskripsi, hanya_generus, peran_izin(izin_kode, izin(deskripsi))), kelompok(nama)",
      )
      .eq("user_id", admin.userId)
      .returns<BarisPenugasan[]>(),
    supabase.from("kategori_jamaah").select("nama").eq("termasuk_generus", true).order("urutan"),
  ]);
  const pengelola = pengelolaAkun(admin);

  if (!penugasan) {
    return <Card className="text-sm text-danger">Mohon maaf, data wewenang belum berhasil dimuat. Silakan muat ulang halaman.</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      {penugasan.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{p.peran?.nama ?? "Peran"}</h2>
            <Badge nada="utama">{p.kelompok?.nama ?? "Seluruh desa"}</Badge>
            {p.peran?.hanya_generus && <Badge>Khusus jamaah generus</Badge>}
          </div>
          {p.peran?.deskripsi && <p className="mt-1 text-sm text-muted">{p.peran.deskripsi}</p>}
          {p.peran?.hanya_generus && (
            <p className="mt-3 rounded-control bg-surface-muted p-3 text-sm">
              Berlaku hanya untuk jamaah berkategori generus
              {kategoriGenerus?.length ? ` (${kategoriGenerus.map((k) => k.nama).join(", ")})` : ""}{" "}
              di {p.kelompok?.nama ?? "seluruh desa"}. Jamaah di luar wilayah ini tidak ditampilkan.
            </p>
          )}

          <p className="mt-5 mb-2 text-sm font-medium">Yang bisa dilakukan</p>
          {p.peran && p.peran.peran_izin.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {p.peran.peran_izin
                .slice()
                .sort((a, b) => a.izin_kode.localeCompare(b.izin_kode))
                .map((i) => (
                  <li key={i.izin_kode} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>
                      {i.izin?.deskripsi ?? i.izin_kode}
                      {p.kelompok && <span className="text-muted"> ({p.kelompok.nama})</span>}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Belum ada izin untuk peran ini.</p>
          )}
        </Card>
      ))}
      <p className="text-sm text-muted">
        Akun ini dikelola oleh <span className="font-medium text-fg">{pengelola}</span>. Silakan
        hubungi pengelola tersebut bila memerlukan akses tambahan atau perubahan peran.
      </p>
    </div>
  );
}
