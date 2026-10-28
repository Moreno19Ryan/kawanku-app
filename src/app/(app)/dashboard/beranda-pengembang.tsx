import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert, CircleCheck, ClipboardCopy, History, LifeBuoy, Gauge, TriangleAlert } from "lucide-react";
import { KartuAsisten } from "@/components/asisten/kartu-asisten";
import {
  Angka,
  DaftarPerhatian,
  DaftarPintasan,
  PanelAdmin,
  TataBeranda,
  type Perhatian,
  type Pintasan,
} from "@/components/beranda/tata-beranda";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSaranAdmin } from "@/lib/asisten/data";
import { labelPenugasan, type AdminSaatIni } from "@/lib/auth/admin";
import { hariIniWib } from "@/lib/kegiatan/jadwal";
import {
  nilaiKesehatan,
  nilaiTugas,
  ringkasKesehatan,
  tingkatKeseluruhan,
  type DataKesehatan,
  type Tingkat,
} from "@/lib/sistem/kesehatan";
import { sejakHari } from "@/lib/sistem/jejak";
import { createClient } from "@/lib/supabase/server";

const IKON: Record<Tingkat, typeof CircleCheck> = { baik: CircleCheck, perhatian: TriangleAlert, masalah: CircleAlert };
const WARNA: Record<Tingkat, string> = { baik: "text-success", perhatian: "text-warning", masalah: "text-danger" };
const RINGKAS: Record<Tingkat, string> = {
  baik: "Alhamdulillah, semua berjalan normal.",
  perhatian: "Ada yang perlu diperhatikan.",
  masalah: "Ada masalah yang perlu ditangani.",
};

/**
 * Beranda pengembang (pemegang sistem.kelola): kerangka sama dengan Beranda
 * admin, isinya keadaan aplikasi. Data dari RPC kesehatan_sistem (sama
 * dengan Panel pengembang) + hitungan ringan; bagian yang gagal dibaca
 * tidak menghentikan halaman.
 */
export async function BerandaPengembang({ admin }: { admin: AdminSaatIni }) {
  const supabase = await createClient();
  const awalHari = `${hariIniWib()}T00:00:00+07:00`;
  const [kesehatan, permintaan, faktor, adminAktif, akunGenerus, galat7, jejakHariIni] = await Promise.all([
    supabase.rpc("kesehatan_sistem"),
    supabase.from("permintaan_identitas").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
    supabase.auth.mfa.listFactors(),
    supabase.from("admin").select("user_id", { count: "exact", head: true }).eq("aktif", true),
    supabase.from("akun_generus").select("user_id", { count: "exact", head: true }).eq("aktif", true),
    supabase.from("galat_aplikasi").select("id", { count: "exact", head: true }).gte("terakhir_at", sejakHari(7)),
    supabase.from("jejak_aktivitas").select("id", { count: "exact", head: true }).gte("created_at", awalHari),
  ]);

  const data = kesehatan.error ? null : (kesehatan.data as DataKesehatan);
  const butir = data ? nilaiKesehatan(data) : [];
  const tingkat: Tingkat = data ? tingkatKeseluruhan(butir) : "perhatian";
  const galatBaru = data?.galat.baru ?? 0;
  const menunggu = permintaan.count ?? 0;
  const perangkatMfa = faktor.data?.totp.length ?? 0;

  const perhatian: Perhatian[] = [
    galatBaru > 0 && { href: "/pengaturan/sistem", teks: `${galatBaru} galat belum dicek`, penting: true },
    ...(data?.tugas ?? [])
      .map((t) => ({ t, nilai: nilaiTugas(t) }))
      .filter(({ nilai }) => nilai.tingkat !== "baik")
      .map(({ nilai }) => ({
        href: "/pengaturan/sistem",
        teks: `Tugas ${nilai.judul}: ${nilai.isi.replace(/\.$/, "").toLowerCase()}`,
        penting: nilai.tingkat === "masalah",
      })),
    ...butir
      .filter((b) => b.tingkat !== "baik" && b.judul !== "Galat aplikasi" && b.judul !== "Tugas otomatis")
      .map((b) => ({
        href: b.judul === "Cadangan data" ? "/pengaturan/cadangan" : "/pengaturan/sistem",
        teks: `${b.judul}: ${b.isi}`,
        penting: b.tingkat === "masalah",
      })),
    menunggu > 0 && { href: "/pengaturan/sistem", teks: `${menunggu} permintaan lihat NIK/KK menunggu`, penting: true },
    perangkatMfa < 2 && {
      href: "/pengaturan/akun",
      teks: "Perangkat cadangan verifikasi dua langkah belum didaftarkan",
    },
  ].filter((p) => !!p);

  const lain = perhatian.filter((p) => !p.teks.includes("galat belum dicek")).length;
  const bagian = [galatBaru > 0 && `${galatBaru} galat baru`, lain > 0 && `${lain} hal perlu diperhatikan`].filter(Boolean);
  const kalimat = !data
    ? "Mohon maaf, keadaan sistem belum terbaca. Silakan buka Panel pengembang."
    : bagian.length === 0
      ? "Alhamdulillah, semua sistem berjalan normal."
      : `Ada ${bagian.join(" dan ")}.`;

  const pintasan: Pintasan[] = [
    { href: "/pengaturan/sistem", label: "Panel pengembang", ikon: Gauge, angka: galatBaru },
    { href: "/pengaturan/bantuan-akun", label: "Bantuan akun", ikon: LifeBuoy },
    { href: "/pengaturan/jejak", label: "Jejak aktivitas", ikon: History },
    { href: "/pengaturan/sistem#laporan-masalah", label: "Salin laporan", ikon: ClipboardCopy },
  ];

  const IkonTingkat = IKON[tingkat];

  return (
    <TataBeranda
      panel={<PanelAdmin nama={admin.nama} peran={admin.penugasan.map(labelPenugasan).join(" · ")} kalimat={kalimat} />}
      mengambang={
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <IkonTingkat className={`size-7 shrink-0 ${WARNA[tingkat]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Kesehatan sistem</h2>
              <p className="text-sm text-muted">{data ? RINGKAS[tingkat] : "Belum terbaca."}</p>
            </div>
            {/* buttonClass memakai inline-flex, jadi sembunyikan lewat pembungkus. */}
            <div className="hidden lg:block">
              <Link href="/pengaturan/sistem" className={buttonClass("utama")}>
                Buka Panel pengembang
              </Link>
            </div>
          </div>
          {data && (
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-2.5 2xl:grid-cols-5">
              {ringkasKesehatan(data).map((k, i) => (
                <li
                  key={k.judul}
                  className={`rounded-control bg-bg px-3 py-2.5 text-sm ${i === 4 ? "hidden lg:block" : ""}`}
                >
                  <span className="block text-xs text-muted">{k.judul}</span>
                  <span className={`font-semibold ${WARNA[k.tingkat]}`}>{k.nilai}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="lg:hidden">
            <Link href="/pengaturan/sistem" className={buttonClass("utama", "h-12 w-full")}>
              Buka Panel pengembang
            </Link>
          </div>
        </Card>
      }
      samping={
        <>
          <DaftarPintasan pintasan={pintasan} />
          <DaftarPerhatian perhatian={perhatian} />
          <Suspense fallback={<Skeleton className="h-28" />}>
            <AsistenPengembang />
          </Suspense>
        </>
      }
      badan={
        <section aria-label="Angka sistem" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Angka label="Admin aktif" nilai={adminAktif.count ?? 0} href="/pengaturan/admin" />
          <Angka label="Akun generus aktif" nilai={akunGenerus.count ?? 0} href="/pengaturan/bantuan-akun" />
          <Angka label="Galat 7 hari" nilai={galat7.count ?? 0} href="/pengaturan/sistem" />
          <Angka label="Aktivitas hari ini" nilai={jejakHariIni.count ?? 0} href="/pengaturan/jejak" />
        </section>
      }
    />
  );
}

async function AsistenPengembang() {
  return <KartuAsisten saran={await getSaranAdmin()} />;
}
