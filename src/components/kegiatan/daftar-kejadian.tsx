import Link from "next/link";
import { ChevronRight, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { hariIniWib, tambahHari, type Kejadian } from "@/lib/kegiatan/jadwal";
import { jam } from "@/lib/waktu";

function judulTanggal(tanggal: string, hariIni: string) {
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${tanggal}T00:00:00Z`));
  if (tanggal === hariIni) return `Hari ini · ${label}`;
  if (tanggal === tambahHari(hariIni, 1)) return `Besok · ${label}`;
  return label;
}

export const hrefPertemuan = (k: Kejadian) =>
  `/kegiatan/pertemuan?k=${k.kegiatan.id}&kel=${k.kelompokId ?? "desa"}&t=${k.tanggal}`;

/** Daftar pertemuan dikelompokkan per tanggal (gaya agenda). */
export function DaftarKejadian({
  kejadian,
  namaKelompok,
  tautan = true,
  kosong = "Tidak ada kegiatan di rentang ini.",
}: {
  kejadian: Kejadian[];
  namaKelompok: Map<string, string>;
  tautan?: boolean;
  kosong?: string;
}) {
  if (kejadian.length === 0) return <Card className="text-center text-sm text-muted">{kosong}</Card>;
  const hariIni = hariIniWib();
  const perTanggal = new Map<string, Kejadian[]>();
  for (const k of kejadian) perTanggal.set(k.tanggal, [...(perTanggal.get(k.tanggal) ?? []), k]);

  return (
    <div className="flex flex-col gap-5">
      {[...perTanggal.entries()].map(([tanggal, isi]) => (
        <section key={tanggal} className="flex flex-col gap-2">
          <h2 className={`px-1 text-sm font-semibold ${tanggal === hariIni ? "text-primary" : "text-muted"}`}>
            {judulTanggal(tanggal, hariIni)}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-surface">
            {isi.map((k) => {
              const isiBaris = (
                <>
                  <span className="w-14 shrink-0 text-center">
                    <span className={`block text-lg font-semibold ${k.status === "dibatalkan" ? "text-muted line-through" : ""}`}>
                      {jam(k.mulai)}
                    </span>
                    {k.dipindah && <span className="block text-[10px] font-medium text-warning">dipindah</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${k.status === "dibatalkan" ? "text-muted line-through" : ""}`}>
                        {k.kegiatan.nama}
                      </span>
                      {k.kelompokId && <Badge>{namaKelompok.get(k.kelompokId) ?? "Kelompok"}</Badge>}
                      {k.kegiatan.hanya_generus && <Badge nada="utama">Generus</Badge>}
                      {k.status === "dibatalkan" && <Badge nada="bahaya">Libur / batal</Badge>}
                      {k.sesiId && <Badge nada="sukses">Absensi dibuka</Badge>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                      {k.status === "dibatalkan" ? (
                        <span>{k.alasanBatal}</span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3.5" aria-hidden />
                            {k.pemateri ?? "Pemateri belum diisi"}
                          </span>
                          {k.materi && <span className="truncate">· {k.materi}</span>}
                          {k.kegiatan.lokasi && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" aria-hidden />
                              {k.kegiatan.lokasi}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </span>
                  {tautan && <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />}
                </>
              );
              return (
                <li key={k.kunci}>
                  {tautan ? (
                    <Link
                      href={hrefPertemuan(k)}
                      className="flex items-center gap-4 px-4 py-3 transition-colors duration-200 ease-oneui hover:bg-surface-muted sm:px-5"
                    >
                      {isiBaris}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 px-4 py-3 sm:px-5">{isiBaris}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
