import { TanganiUsulan } from "@/components/jamaah/usulan-koreksi";
import { Badge } from "@/components/ui/badge";
import { tanganiPengajuanIzin } from "@/lib/absensi/actions";
import { labelPengajuan, type PengajuanIzin } from "@/lib/absensi/izin";
import { waktuRelatif } from "@/lib/waktu";

const tanggalPendek = (t: string) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${t}T00:00:00Z`),
  );

/** Pengajuan izin generus: setujui / tolak (yang menunggu) atau status. */
export function DaftarPengajuan({
  pengajuan,
  tampilkanKegiatan = true,
}: {
  pengajuan: (PengajuanIzin & { bolehTangani: boolean })[];
  tampilkanKegiatan?: boolean;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
      {pengajuan.map((p) => (
        <li key={p.id} className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-start gap-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.jamaah?.nama_lengkap ?? "Jamaah"}</span>
              <span className="block text-muted">
                {[tampilkanKegiatan && `${tanggalPendek(p.tanggal)} · ${p.kegiatan?.nama ?? "Kegiatan"}`, labelPengajuan(p)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {p.keterangan && <span className="block">“{p.keterangan}”</span>}
              <span className="block text-xs text-muted">Diajukan {waktuRelatif(p.created_at)}</span>
              {p.tanggapan && <span className="mt-1 block text-muted">Tanggapan: {p.tanggapan}</span>}
            </span>
            {p.status !== "menunggu" && (
              <Badge nada={p.status === "disetujui" ? "sukses" : "bahaya"}>
                {p.status === "disetujui" ? "Disetujui" : "Ditolak"}
              </Badge>
            )}
          </div>
          {p.status === "menunggu" && p.bolehTangani && (
            <TanganiUsulan
              aksi={tanganiPengajuanIzin.bind(null, p.id)}
              setuju={{ nilai: "disetujui", label: "Setujui" }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
