import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { FormIzin } from "@/components/generus/form-izin";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { labelPengajuan, type PengajuanIzin } from "@/lib/absensi/izin";
import { batalkanIzin } from "@/lib/generus/actions";
import { wajibGenerus } from "@/lib/generus/akun";
import { getKalender } from "@/lib/kegiatan/data";
import { hariIniWib, tambahHari } from "@/lib/kegiatan/jadwal";
import { createClient } from "@/lib/supabase/server";
import { jam } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Ajukan Izin",
};

type Milik = Omit<PengajuanIzin, "jamaah">;

const tanggalPendek = (t: string) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${t}T00:00:00Z`),
  );

export default function IzinPage({ searchParams }: PageProps<"/saya/izin">) {
  return (
    <div className="lg:max-w-2xl">
      <Link href="/saya" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Beranda
      </Link>
      <Suspense fallback={<Memuat className="mt-4 h-96" />}>
        <AjukanIzin cari={searchParams} />
      </Suspense>
    </div>
  );
}

async function AjukanIzin({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [generus, param] = await Promise.all([wajibGenerus(), cari]);
  const hariIni = hariIniWib();
  const supabase = await createClient();
  const [kejadian, { data: milik }] = await Promise.all([
    getKalender(hariIni, tambahHari(hariIni, 13), [generus.jamaah.kelompokId]),
    supabase
      .from("pengajuan_izin")
      .select("id, jamaah_id, kegiatan_id, kelompok_id, tanggal, jenis, alasan_izin, keterangan, status, tanggapan, created_at, kegiatan:kegiatan_id(nama)")
      .eq("jamaah_id", generus.jamaah.id)
      .order("tanggal", { ascending: false })
      .limit(20)
      .returns<Milik[]>(),
  ]);
  // Pertemuan yang sudah lewat jamnya tidak ditawarkan.
  const sekarang = new Date().toISOString();
  const pilihan = kejadian
    .filter((k) => k.status === "terjadwal" && k.selesai > sekarang)
    .map((k) => ({
      value: `${k.kegiatan.id}|${k.tanggal}`,
      label: `${tanggalPendek(k.tanggal)} · ${jam(k.mulai)} · ${k.kegiatan.nama}`,
    }));
  const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const awal = `${satu(param.k) ?? ""}|${satu(param.t) ?? ""}`;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajukan izin</h1>
        <p className="text-sm text-muted">
          Berhalangan hadir? Kabari pengurus sebelum pengajian. Admin yang menyetujui.
        </p>
      </div>
      <Card>
        <FormIzin pilihan={pilihan} awal={pilihan.some((p) => p.value === awal) ? awal : undefined} />
      </Card>

      {(milik ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">Pengajuanku</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {(milik ?? []).map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-5 py-4 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.kegiatan?.nama ?? "Kegiatan"}</span>
                  <span className="block text-muted">
                    {tanggalPendek(p.tanggal)} · {labelPengajuan(p)}
                    {p.keterangan ? ` · ${p.keterangan}` : ""}
                  </span>
                  {p.tanggapan && <span className="mt-1 block text-muted">Admin: {p.tanggapan}</span>}
                </span>
                <span className="flex flex-col items-end gap-2">
                  <Badge nada={p.status === "disetujui" ? "sukses" : p.status === "ditolak" ? "bahaya" : "netral"}>
                    {p.status === "disetujui" ? "Disetujui" : p.status === "ditolak" ? "Ditolak" : "Menunggu"}
                  </Badge>
                  {p.status === "menunggu" && p.tanggal >= hariIni && (
                    <TombolAksi aksi={batalkanIzin.bind(null, p.id)} label="Batalkan" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
