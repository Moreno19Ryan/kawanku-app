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
import { punyaIzin, punyaIzinDi, wajibKelolaAkun } from "@/lib/auth/admin";
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
    peran_id: string;
    kelompok_id: string | null;
    peran: { nama: string; peran_izin: { izin_kode: string }[] } | null;
    kelompok: { nama: string } | null;
  }[];
};

type BarisPeran = Pick<OpsiPeran, "id" | "nama" | "wilayah"> & {
  hanya_generus: boolean;
  peran_izin: { izin_kode: string }[];
};

/** Peran tingkat sistem (pengembang) = memegang izin sistem.kelola. */
const IZIN_SISTEM = "sistem.kelola";
const tingkatSistem = (izin: { izin_kode: string }[] | undefined) =>
  Boolean(izin?.some((i) => i.izin_kode === IZIN_SISTEM));

export default function AdminPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader
        title="Admin & akses"
        description="Buat akun admin, aktifkan atau nonaktifkan, dan atur peran serta wilayahnya. Yang tampil hanya akun yang menjadi wewenangmu."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DaftarAdmin />
      </Suspense>
    </>
  );
}

async function DaftarAdmin() {
  const saya = await wajibKelolaAkun();
  const supabase = await createClient();

  const [{ data: admin }, { data: peran }, { data: kelompok }] = await Promise.all([
    supabase
      .from("admin")
      .select(
        "user_id, nama, aktif, penugasan_peran(id, peran_id, kelompok_id, peran(nama, peran_izin(izin_kode)), kelompok(nama))",
      )
      .order("aktif", { ascending: false })
      .order("nama")
      .returns<BarisAdmin[]>(),
    supabase
      .from("peran")
      .select("id, nama, wilayah, hanya_generus, peran_izin(izin_kode)")
      .order("nama")
      .returns<BarisPeran[]>(),
    supabase.from("kelompok").select("id, nama").eq("aktif", true).order("nomor"),
  ]);

  if (!admin || !peran || !kelompok) {
    return <Card className="text-sm text-danger">Gagal memuat daftar admin. Muat ulang halaman.</Card>;
  }

  // Peran + wilayah yang boleh diberikan, cerminan private.boleh_beri_peran:
  // peran sistem → sistem.kelola; generus di kelompok → akses.kelola_generus
  // di kelompok itu; selain itu → akses.kelola. RLS tetap penentunya.
  const sayaSistem = punyaIzin(saya, IZIN_SISTEM);
  const sayaAkses = punyaIzin(saya, "akses.kelola");
  const pilihanPeran: OpsiPeran[] = peran
    .map((p) => {
      const sistem = tingkatSistem(p.peran_izin);
      const bolehUmum = sistem ? sayaSistem : sayaAkses;
      const bolehDesa = p.wilayah !== "kelompok" && bolehUmum;
      const kelompokIds =
        p.wilayah === "desa"
          ? []
          : kelompok
              .map((k) => k.id)
              .filter((id) =>
                p.hanya_generus && !sistem
                  ? punyaIzinDi(saya, "akses.kelola_generus", id)
                  : bolehUmum,
              );
      return { id: p.id, nama: p.nama, wilayah: p.wilayah, bolehDesa, kelompokIds };
    })
    .filter((p) => p.bolehDesa || p.kelompokIds.length > 0);
  const bolehBeri = (peranId: string, kelompokId: string | null) => {
    const o = pilihanPeran.find((p) => p.id === peranId);
    return Boolean(o && (kelompokId ? o.kelompokIds.includes(kelompokId) : o.bolehDesa));
  };

  // Akun yang boleh dikelola, menurut database. Cadangan sebelum migrasi
  // kelola_admin_generus: aturan lama (bukan akun pengembang, atau saya pengembang).
  const { data: dapatDikelola, error: galatDikelola } = await supabase.rpc("akun_dapat_dikelola");
  const dikelola = new Set<string>(galatDikelola ? [] : (dapatDikelola as string[]));
  const bisaKelola = (a: BarisAdmin) =>
    galatDikelola
      ? sayaAkses && (sayaSistem || !a.penugasan_peran.some((p) => tingkatSistem(p.peran?.peran_izin)))
      : dikelola.has(a.user_id);

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
      {!sayaAkses && (
        <Card className="bg-primary-soft text-sm text-primary shadow-none">
          Kamu bisa membuat dan mengelola akun <b>admin generus</b> untuk kelompokmu. Akun admin
          lain dikelola admin desa.
        </Card>
      )}
      {adminAuth && pilihanPeran.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">Tambah admin</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            Aplikasi membuat kata sandi sementara. Sampaikan ke pemiliknya, lalu ia menggantinya
            sendiri setelah login.
          </p>
          <FormBuatAdmin peran={pilihanPeran} kelompok={kelompok} />
        </Card>
      ) : !adminAuth ? (
        <Card className="bg-primary-soft text-sm text-primary shadow-none">
          Pembuatan akun dari aplikasi belum aktif (SUPABASE_SECRET_KEY belum dipasang di
          server). Sementara, akun baru dibuat lewat Supabase lalu dihubungkan dengan SQL.
        </Card>
      ) : null}

      <ul className="flex flex-col gap-3">
        {admin.map((a) => {
          const diriSendiri = a.user_id === saya.userId;
          const akunSistem = a.penugasan_peran.some((p) => tingkatSistem(p.peran?.peran_izin));
          const bolehKelola = bisaKelola(a);
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
                    {!bolehKelola && !diriSendiri && (
                      <p className="mt-1 text-xs text-muted">
                        {akunSistem
                          ? "Akun pengembang: hanya bisa diubah oleh pengembang."
                          : "Bukan wewenangmu: dikelola admin wilayahnya."}
                      </p>
                    )}
                  </div>
                  {!diriSendiri && bolehKelola && (
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
                        {bolehKelola && bolehBeri(p.peran_id, p.kelompok_id) && (
                          <TombolAksi
                            aksi={hapusPenugasan.bind(null, p.id)}
                            label="Cabut"
                            varian="netral"
                            konfirmasi={`Cabut peran ${p.peran?.nama ?? ""} dari ${a.nama}?`}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                  {bolehKelola && pilihanPeran.length > 0 && (
                    <div className="mt-2">
                      <FormTambahPenugasan
                        aksi={tambahPenugasan.bind(null, a.user_id)}
                        peran={pilihanPeran}
                        kelompok={kelompok}
                      />
                    </div>
                  )}
                </div>

                {bolehKelola && (
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
                )}
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
