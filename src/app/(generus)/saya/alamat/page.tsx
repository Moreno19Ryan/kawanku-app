import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { FormAlamat, type NilaiPribadi } from "@/components/jamaah/form-data-sensitif";
import { Card } from "@/components/ui/card";
import { simpanAlamatSaya } from "@/lib/generus/actions";
import { wajibGenerus } from "@/lib/generus/akun";
import { hitungUsia } from "@/lib/jamaah/kategori";
import { dokumenIdentitas } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Alamat Saya",
};

const KOLOM_ALAMAT =
  "domisili_sama_ktp, ktp_kode_wilayah, ktp_jalan, ktp_rt, ktp_rw, ktp_kode_pos, dom_kode_wilayah, dom_jalan, dom_rt, dom_rw, dom_kode_pos";

export default function AlamatSayaPage() {
  return (
    <>
      <Link href="/saya/profil" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Profil saya
      </Link>
      <Suspense fallback={<Memuat className="mt-4 h-96" />}>
        <AlamatSaya />
      </Suspense>
    </>
  );
}

async function AlamatSaya() {
  const generus = await wajibGenerus();
  const supabase = await createClient();
  const [{ data: jamaah }, { data: alamat }] = await Promise.all([
    supabase.from("jamaah").select("tanggal_lahir, tahun_lahir").eq("id", generus.jamaah.id).maybeSingle(),
    // RLS: generus hanya bisa membaca baris miliknya sendiri. Nama orang tua tidak diambil.
    supabase.from("jamaah_pribadi").select(KOLOM_ALAMAT).eq("jamaah_id", generus.jamaah.id).maybeSingle(),
  ]);
  const dokumen = dokumenIdentitas(hitungUsia(jamaah?.tanggal_lahir ?? null, jamaah?.tahun_lahir ?? null));
  const nilai = alamat ? ({ ...alamat, nama_ayah: null, nama_ibu: null } as NilaiPribadi) : null;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alamat saya</h1>
        <p className="text-sm text-muted">
          Pastikan alamat sesuai {dokumen} dan alamat tinggalmu sekarang sudah benar. Kalau ada yang berubah, ubah di sini.
        </p>
      </div>
      <Card>
        <FormAlamat aksi={simpanAlamatSaya} nilai={nilai} dokumen={dokumen} />
      </Card>
      <p className="px-1 text-xs text-muted">
        Alamat hanya terlihat olehmu dan pengurus yang berwenang. Nama orang tua diubah lewat admin.
      </p>
    </div>
  );
}
