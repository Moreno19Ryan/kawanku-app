import Link from "next/link";
import { UserPen } from "lucide-react";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { tandaiPerubahanDicek } from "@/lib/jamaah/actions";
import type { PerubahanGenerus, PerubahanPerJamaah } from "@/lib/jamaah/perubahan";
import { LABEL_BAGIAN_PERUBAHAN, LABEL_PENDIDIKAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import { tanggalPanjang, waktuRelatif } from "@/lib/waktu";

function nilai(bagian: string, isi: string | null): string {
  if (isi === null) return "kosong";
  if (bagian === "tanggal_lahir") return tanggalPanjang(isi);
  if (bagian === "status_sekolah") return LABEL_STATUS_SEKOLAH[isi] ?? isi;
  if (bagian === "pendidikan_terakhir") return LABEL_PENDIDIKAN[isi] ?? isi;
  if (bagian === "kelas") return `Kelas ${isi}`;
  return `“${isi}”`;
}

function Butir({ b }: { b: PerubahanGenerus }) {
  const label = LABEL_BAGIAN_PERUBAHAN[b.bagian] ?? b.bagian;
  // Kontak, orang tua & alamat: isinya tidak dicatat (ikut izin tabelnya).
  const adaNilai = b.nilai_lama !== null || b.nilai_baru !== null;
  return (
    <li>
      <span className="font-medium">{label}</span>{" "}
      {adaNilai ? (
        <>
          {nilai(b.bagian, b.nilai_lama)} → <span className="font-semibold">{nilai(b.bagian, b.nilai_baru)}</span>
        </>
      ) : (
        <span className="text-muted">diperbarui</span>
      )}
      <span className="text-xs text-muted"> · {waktuRelatif(b.created_at)}</span>
    </li>
  );
}

/** Data diri yang diubah generus sendiri, menunggu dicek admin (Perlu dicek & detail jamaah). */
export function DaftarPerubahan({
  perubahan,
  tampilkanNama = true,
}: {
  perubahan: PerubahanPerJamaah[];
  tampilkanNama?: boolean;
}) {
  if (perubahan.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <UserPen className="size-4 text-primary" aria-hidden />
        {tampilkanNama ? `Diubah generus sendiri (${perubahan.length} jamaah)` : "Diubah generus sendiri"}
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
        {perubahan.map((p) => (
          <li key={p.jamaah.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 text-sm">
              {tampilkanNama && (
                <Link href={`/jamaah/${p.jamaah.id}`} className="font-semibold text-primary hover:underline">
                  {p.jamaah.nama_lengkap}
                </Link>
              )}
              <ul className={`flex flex-col gap-1 ${tampilkanNama ? "mt-1" : ""}`}>
                {p.butir.map((b) => (
                  <Butir key={b.id} b={b} />
                ))}
              </ul>
            </div>
            <TombolAksi aksi={tandaiPerubahanDicek.bind(null, p.jamaah.id)} label="Sudah dicek" varian="kedua" />
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-muted">
        Sudah tersimpan otomatis. Bila ada yang keliru, betulkan lewat Ubah data, lalu tandai “Sudah dicek”.
      </p>
    </section>
  );
}
