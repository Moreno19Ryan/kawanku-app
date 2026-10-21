import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormBuatAdmin } from "@/components/pengaturan/form-buat-admin";
import { FormTambahPenugasan } from "@/components/pengaturan/form-tambah-penugasan";
import { FormUbahNama } from "@/components/pengaturan/form-ubah-nama";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import type { OpsiPeran } from "@/components/pengaturan/pilih-peran-wilayah";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { TombolAturUlangSandi } from "@/components/pengaturan/tombol-atur-ulang-sandi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { wajibIzin } from "@/lib/auth/admin";
import {
  aturUlangKataSandi,
  hapusPenugasan,
  tambahPenugasan,
  ubahNamaAdmin,
  ubahStatusAdmin,
} from "@/lib/pengaturan/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Admin & akses",
};

type BarisAdmin = {
  user_id: string;
  nama: string;
  aktif: boolean;
  penugasan_peran: {
    id: string;
    peran: { nama: string } | null;
    kelompok: { nama: string } | null;
  }[];
};

export default function AdminPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Admin & akses"
        description="Buat akun admin, aktifkan atau nonaktifkan, dan atur peran serta wilayahnya."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarAdmin />
      </Suspense>
    </>
  );
}

async function DaftarAdmin() {
  const saya = await wajibIzin("akses.kelola");
  const supabase = await createClient();

  const [{ data: admin }, { data: peran }, { data: kelompok }] = await Promise.all([
    supabase
      .from("admin")
      .select("user_id, nama, aktif, penugasan_peran(id, peran(nama), kelompok(nama))")
      .order("aktif", { ascending: false })
      .order("nama")
      .returns<BarisAdmin[]>(),
    supabase.from("peran").select("id, nama, wilayah").order("nama").returns<OpsiPeran[]>(),
    supabase.from("kelompok").select("id, nama").eq("aktif", true).order("nomor"),
  ]);

  if (!admin || !peran || !kelompok) {
    return <Card className="text-sm text-danger">Gagal memuat daftar admin. Muat ulang halaman.</Card>;
  }

  // Secret key hanya dipakai di sini SETELAH wajibIzin("akses.kelola") di atas.
  const adminAuth = createAdminClient();
  const akun = new Map<string, { email?: string; terakhirMasuk?: string }>();
  if (adminAuth) {
    const { data } = await adminAuth.auth.admin.listUsers({ perPage: 1000 });
    data?.users.forEach((u) =>
      akun.set(u.id, { email: u.email, terakhirMasuk: u.last_sign_in_at ?? undefined }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {adminAuth ? (
        <Card>
          <h2 className="text-lg font-semibold">Tambah admin</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Aplikasi membuat kata sandi sementara. Sampaikan ke pemiliknya, lalu ia menggantinya
            sendiri setelah login.
          </p>
          <FormBuatAdmin peran={peran} kelompok={kelompok} />
        </Card>
      ) : (
        <Card className="bg-primary-soft text-sm text-primary shadow-none">
          Pembuatan akun dari aplikasi belum aktif (SUPABASE_SECRET_KEY belum dipasang di
          server). Sementara, akun baru dibuat lewat Supabase lalu dihubungkan dengan SQL.
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {admin.map((a) => {
          const diriSendiri = a.user_id === saya.userId;
          return (
            <li key={a.user_id}>
              <Card className={a.aktif ? "" : "opacity-75"}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft font-semibold text-primary">
                    {a.nama.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                      {a.nama}
                      {diriSendiri && <span className="text-sm font-normal text-muted">(kamu)</span>}
                      <Badge nada={a.aktif ? "sukses" : "bahaya"}>
                        {a.aktif ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </p>
                    {akun.has(a.user_id) && (
                      <InfoAkun {...akun.get(a.user_id)!} />
                    )}
                  </div>
                  {!diriSendiri && (
                    <TombolAksi
                      aksi={ubahStatusAdmin.bind(null, a.user_id, !a.aktif)}
                      label={a.aktif ? "Nonaktifkan" : "Aktifkan"}
                      varian={a.aktif ? "bahaya" : "kedua"}
                      konfirmasi={
                        a.aktif
                          ? `Nonaktifkan ${a.nama}? Ia tidak bisa login sampai diaktifkan lagi.`
                          : undefined
                      }
                    />
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  <p className="text-sm text-muted">Peran</p>
                  {a.penugasan_peran.length === 0 && (
                    <p className="text-sm text-danger">
                      Belum punya peran, jadi belum bisa masuk aplikasi.
                    </p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {a.penugasan_peran.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-control bg-surface-muted py-1.5 pr-1.5 pl-4"
                      >
                        <span className="text-sm font-medium">
                          {p.peran?.nama ?? "Peran"}
                          <span className="font-normal text-muted">
                            {" · "}
                            {p.kelompok?.nama ?? "Seluruh desa"}
                          </span>
                        </span>
                        <TombolAksi
                          aksi={hapusPenugasan.bind(null, p.id)}
                          label="Cabut"
                          varian="netral"
                          konfirmasi={`Cabut peran ${p.peran?.nama ?? ""} dari ${a.nama}?`}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <FormTambahPenugasan
                      aksi={tambahPenugasan.bind(null, a.user_id)}
                      peran={peran}
                      kelompok={kelompok}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                  <details>
                    <summary className="w-fit cursor-pointer list-none rounded-pill text-sm font-medium text-primary hover:underline">
                      Ubah nama
                    </summary>
                    <div className="mt-2 max-w-md">
                      <FormUbahNama
                        aksi={ubahNamaAdmin.bind(null, a.user_id)}
                        nama={a.nama}
                        label={`Nama ${a.nama}`}
                        maxLength={80}
                      />
                    </div>
                  </details>
                  {adminAuth && !diriSendiri && (
                    <TombolAturUlangSandi
                      aksi={aturUlangKataSandi.bind(null, a.user_id)}
                      nama={a.nama}
                    />
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Email + kapan terakhir masuk (dari Supabase Auth, butuh secret key). */
function InfoAkun({ email, terakhirMasuk }: { email?: string; terakhirMasuk?: string }) {
  return (
    <div className="mt-0.5 flex flex-col text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-3">
      {email && <span className="truncate">{email}</span>}
      {terakhirMasuk ? (
        <span title={tanggalJam(terakhirMasuk)}>Terakhir masuk {waktuRelatif(terakhirMasuk)}</span>
      ) : (
        <span className="text-warning">Belum pernah masuk</span>
      )}
    </div>
  );
}
