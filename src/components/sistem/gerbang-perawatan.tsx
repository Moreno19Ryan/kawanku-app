import type { ReactNode } from "react";
import { Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { keluar } from "@/lib/auth/actions";
import { getAdminSaatIni, punyaIzin } from "@/lib/auth/admin";
import { getStatusSistem, type StatusSistem } from "@/lib/sistem/data";
import { tanggalJam } from "@/lib/waktu";

/**
 * Saat mode perawatan aktif, admin selain pengembang melihat halaman
 * perawatan alih-alih isi halaman. Pengembang tetap bisa bekerja, dengan
 * pengingat di atas. Harus di dalam <Suspense> (membaca sesi).
 */
export async function GerbangPerawatan({ children }: { children: ReactNode }) {
  const [admin, status] = await Promise.all([getAdminSaatIni(), getStatusSistem()]);
  const pengembang = admin !== null && punyaIzin(admin, "sistem.kelola");
  if (status.perawatan && !pengembang) return <HalamanPerawatan status={status} />;

  // Struktur selalu sama (pengingat + children) supaya state form di
  // halaman tidak hilang saat mode perawatan dinyalakan/dimatikan.
  return (
    <>
      {status.perawatan && (
        <div className="mt-4 flex items-center gap-2 rounded-control bg-warning/15 px-4 py-3 text-sm text-fg">
          <Wrench className="size-4 shrink-0 text-warning" aria-hidden />
          Mode perawatan aktif: hanya akun pengembang yang bisa memakai aplikasi.
          {status.darurat && " (dipaksa env MODE_PERAWATAN di server)"}
        </div>
      )}
      {children}
    </>
  );
}

function HalamanPerawatan({ status }: { status: StatusSistem }) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center py-10">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center sm:p-10">
        <span className="flex size-16 items-center justify-center rounded-pill bg-warning/15 text-warning">
          <Wrench className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Sedang perawatan</h1>
        <p className="text-muted">
          {status.pesan ??
            "KawanKu sedang diperbarui supaya lebih baik. Silakan coba lagi beberapa saat lagi."}
        </p>
        {status.perkiraanSelesai && (
          <p className="text-sm">
            Perkiraan selesai:{" "}
            <span className="font-semibold">{tanggalJam(status.perkiraanSelesai)}</span>
          </p>
        )}
        <form action={keluar} className="mt-2">
          <button type="submit" className={buttonClass("netral")}>
            Keluar
          </button>
        </form>
      </Card>
    </div>
  );
}
