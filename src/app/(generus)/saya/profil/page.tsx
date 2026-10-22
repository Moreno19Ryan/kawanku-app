import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, KeyRound, MapPin } from "lucide-react";
import { FormDataDiri, FormUsulanKoreksi } from "@/components/generus/form-profil";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { batalkanUsulanKoreksi } from "@/lib/generus/actions";
import { wajibGenerus } from "@/lib/generus/akun";
import { hitungKelengkapan } from "@/lib/generus/kelengkapan";
import { hariIniWib } from "@/lib/kegiatan/jadwal";
import { LABEL_BAGIAN_USULAN, LABEL_STATUS_PERNIKAHAN } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { waktuRelatif } from "@/lib/waktu";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Profil Saya",
};

type DataDiri = {
  kode: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: "L" | "P";
  status_pernikahan: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  status_sekolah: string | null;
  kelas: number | null;
  pendidikan_terakhir: string | null;
  kegiatan: string | null;
  kategori_jamaah_nama: string | null;
};
type Usulan = {
  id: string;
  bagian: string;
  isi: string;
  status: "menunggu" | "selesai" | "ditolak";
  tanggapan: string | null;
  created_at: string;
};

export default function ProfilSayaPage() {
  return (
    <>
      <Link href="/saya" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Beranda
      </Link>
      <Suspense fallback={<Memuat className="mt-4 h-96" />}>
        <ProfilSaya />
      </Suspense>
    </>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

async function ProfilSaya() {
  const generus = await wajibGenerus();
  const supabase = await createClient();
  // RLS: generus hanya bisa membaca baris miliknya sendiri.
  const [{ data: j }, { data: kontak }, { data: alamat }, { data: usulan }] = await Promise.all([
    supabase
      .from("jamaah_dengan_kategori")
      .select(
        "kode, nama_lengkap, nama_panggilan, jenis_kelamin, status_pernikahan, tempat_lahir, tanggal_lahir, status_sekolah, kelas, pendidikan_terakhir, kegiatan, kategori_jamaah_nama",
      )
      .eq("id", generus.jamaah.id)
      .maybeSingle<DataDiri>(),
    supabase.from("jamaah_kontak").select("no_hp, email, no_hp_wali").eq("jamaah_id", generus.jamaah.id).maybeSingle(),
    supabase
      .from("jamaah_pribadi")
      .select("ktp_wilayah, ktp_jalan, nama_ayah, nama_ibu")
      .eq("jamaah_id", generus.jamaah.id)
      .maybeSingle(),
    supabase
      .from("usulan_koreksi")
      .select("id, bagian, isi, status, tanggapan, created_at")
      .eq("jamaah_id", generus.jamaah.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<Usulan[]>(),
  ]);
  if (!j) return null;
  const ringkasAlamat = [alamat?.ktp_jalan, alamat?.ktp_wilayah?.split(",")[0]].filter(Boolean).join(", ");
  const lengkap = hitungKelengkapan({
    tanggal_lahir: j.tanggal_lahir,
    tempat_lahir: j.tempat_lahir,
    status_sekolah: j.status_sekolah,
    kelas: j.kelas,
    no_hp: kontak?.no_hp ?? null,
    no_hp_wali: kontak?.no_hp_wali ?? null,
    nama_ayah: alamat?.nama_ayah ?? null,
    nama_ibu: alamat?.nama_ibu ?? null,
    ada_alamat: Boolean(alamat?.ktp_wilayah || alamat?.ktp_jalan),
  });

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profil saya</h1>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge nada="utama">{j.kode}</Badge>
          {j.kategori_jamaah_nama && <Badge>{j.kategori_jamaah_nama}</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <Baris label="Nama lengkap">{j.nama_lengkap}</Baris>
          </div>
          <Baris label="Kelompok">{generus.jamaah.kelompok ?? "–"}</Baris>
          <Baris label="Jenis kelamin">{j.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</Baris>
          <Baris label="Status pernikahan">
            {j.status_pernikahan ? (LABEL_STATUS_PERNIKAHAN[j.status_pernikahan] ?? j.status_pernikahan) : "–"}
          </Baris>
        </dl>
        <p className="mt-4 text-xs text-muted">Data di atas diubah admin. Ada yang salah? Laporkan di bagian bawah.</p>
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold text-muted">Data diri</h2>
          <span className="text-xs text-muted">{lengkap.persen}% lengkap</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-label="Kelengkapan data diri"
          aria-valuenow={lengkap.persen}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${lengkap.persen}%` }} />
        </div>
        {lengkap.kurang.length > 0 && (
          <p className="px-1 text-xs text-muted">Belum diisi: {lengkap.kurang.join(", ")}.</p>
        )}
        <Card>
          <FormDataDiri
            hariIni={hariIniWib()}
            nilai={{
              nama_panggilan: j.nama_panggilan,
              tempat_lahir: j.tempat_lahir,
              tanggal_lahir: j.tanggal_lahir,
              status_sekolah: j.status_sekolah,
              kelas: j.kelas,
              pendidikan_terakhir: j.pendidikan_terakhir,
              kegiatan: j.kegiatan,
              no_hp: kontak?.no_hp ?? null,
              email: kontak?.email ?? null,
              no_hp_wali: kontak?.no_hp_wali ?? null,
              nama_ayah: alamat?.nama_ayah ?? null,
              nama_ibu: alamat?.nama_ibu ?? null,
            }}
          />
        </Card>
      </section>

      <Link
        href="/saya/alamat"
        className="flex items-center gap-3 rounded-card bg-surface p-5 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
      >
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Alamat</span>
          <span className="block truncate text-sm text-muted">{ringkasAlamat || "Belum diisi"}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>

      <Link
        href="/saya/pin"
        className="flex items-center gap-3 rounded-card bg-surface p-5 transition-colors duration-200 ease-oneui hover:bg-surface-muted"
      >
        <KeyRound className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 font-medium">Ganti PIN</span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted">Lapor data yang diubah admin</h2>
        <Card>
          <FormUsulanKoreksi />
        </Card>
        {(usulan ?? []).length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {(usulan ?? []).map((u) => (
              <li key={u.id} className="flex items-start gap-3 px-5 py-4 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {LABEL_BAGIAN_USULAN[u.bagian] ?? u.bagian}: <span className="font-normal">“{u.isi}”</span>
                  </span>
                  <span className="block text-xs text-muted">{waktuRelatif(u.created_at)}</span>
                  {u.tanggapan && <span className="mt-1 block text-muted">Admin: {u.tanggapan}</span>}
                </span>
                <span className="flex flex-col items-end gap-2">
                  <Badge nada={u.status === "selesai" ? "sukses" : u.status === "ditolak" ? "bahaya" : "netral"}>
                    {u.status === "selesai" ? "Sudah dibetulkan" : u.status === "ditolak" ? "Ditolak" : "Menunggu"}
                  </Badge>
                  {u.status === "menunggu" && (
                    <TombolAksi aksi={batalkanUsulanKoreksi.bind(null, u.id)} label="Batalkan" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
