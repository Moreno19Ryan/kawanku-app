import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { tanganiUsulanKoreksi } from "@/lib/jamaah/actions";
import type { UsulanKoreksi } from "@/lib/jamaah/usulan";
import { labelNilaiUsulan } from "@/lib/jamaah/usulan-nilai";
import { LABEL_BAGIAN_USULAN } from "@/lib/label";
import { waktuRelatif } from "@/lib/waktu";
import { TanganiUsulan } from "./usulan-koreksi";

/** Laporan data salah dari generus (di Perlu dicek & detail jamaah). */
export function DaftarUsulan({ usulan, tampilkanNama = true }: { usulan: UsulanKoreksi[]; tampilkanNama?: boolean }) {
  if (usulan.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <MessageSquareWarning className="size-4 text-warning" aria-hidden />
        Laporan data salah dari jamaah ({usulan.length})
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
        {usulan.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 px-5 py-4">
            <div className="text-sm">
              {tampilkanNama && u.jamaah && (
                <Link href={`/jamaah/${u.jamaah.id}`} className="font-semibold text-primary hover:underline">
                  {u.jamaah.nama_lengkap}
                </Link>
              )}
              <p className={tampilkanNama ? "mt-1" : ""}>
                <span className="font-medium">{LABEL_BAGIAN_USULAN[u.bagian] ?? u.bagian}</span> seharusnya:{" "}
                {u.nilai ? (
                  <span className="font-semibold">{labelNilaiUsulan(u.bagian, u.nilai, u.nilai_kelas)}</span>
                ) : (
                  <span className="text-fg">“{u.isi}”</span>
                )}
              </p>
              {u.nilai && u.isi !== labelNilaiUsulan(u.bagian, u.nilai, u.nilai_kelas) && (
                <p className="text-muted">Keterangan: “{u.isi}”</p>
              )}
              <p className="text-xs text-muted">Dikirim {waktuRelatif(u.created_at)}</p>
            </div>
            <TanganiUsulan
              aksi={tanganiUsulanKoreksi.bind(null, u.id)}
              terapkan={u.nilai ? "Terapkan" : undefined}
            />
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-muted">
        “Terapkan” langsung memperbarui data jamaah (kategori ikut menyesuaikan). Laporan lain: betulkan di Ubah data, lalu tandai “Sudah dibetulkan”. Jamaah melihat status dan tanggapanmu.
      </p>
    </section>
  );
}
