import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { TombolAksi } from "@/components/pengaturan/tombol-aksi";
import { Card } from "@/components/ui/card";
import {
  INFO_TUGAS,
  nilaiKesehatan,
  nilaiTugas,
  tingkatKeseluruhan,
  type DataKesehatan,
  type Tingkat,
} from "@/lib/sistem/kesehatan";
import { aturTugas, jalankanTugas } from "@/lib/sistem/actions";
import { tanggalJam, waktuRelatif } from "@/lib/waktu";

const IKON: Record<Tingkat, typeof CircleCheck> = {
  baik: CircleCheck,
  perhatian: TriangleAlert,
  masalah: CircleAlert,
};
const WARNA: Record<Tingkat, string> = {
  baik: "text-success",
  perhatian: "text-warning",
  masalah: "text-danger",
};
const RINGKAS: Record<Tingkat, string> = {
  baik: "Alhamdulillah, semua berjalan normal.",
  perhatian: "Ada yang perlu diperhatikan.",
  masalah: "Ada masalah yang perlu ditangani.",
};

/** Kartu hijau/kuning/merah: tugas otomatis, notifikasi, cadangan, ruang database, galat. */
export function KartuKesehatan({ data }: { data: DataKesehatan }) {
  const butir = nilaiKesehatan(data);
  const keseluruhan = tingkatKeseluruhan(butir);
  const Ikon = IKON[keseluruhan];

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Ikon className={`size-7 shrink-0 ${WARNA[keseluruhan]}`} aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Kesehatan sistem</h2>
          <p className="text-sm text-muted">{RINGKAS[keseluruhan]}</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {butir.map((b) => {
          const IkonButir = IKON[b.tingkat];
          return (
            <li key={b.judul} className="flex items-start gap-2.5 text-sm">
              <IkonButir className={`mt-0.5 size-4 shrink-0 ${WARNA[b.tingkat]}`} aria-label={b.tingkat} />
              <span>
                <span className="font-medium">{b.judul}.</span> <span className="text-muted">{b.isi}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Daftar tugas otomatis (pg_cron): keadaan, jalan terakhir, jalankan sekarang, nyalakan/matikan. */
export function KartuTugas({ data }: { data: DataKesehatan }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Tugas otomatis</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Pekerjaan yang dijalankan database sendiri. Bila ada yang tertinggal (mis. absensi belum terbuka), tekan
        Jalankan sekarang.
      </p>
      <ul className="divide-y divide-border">
        {data.tugas.map((t) => {
          const info = INFO_TUGAS[t.nama];
          const nilai = nilaiTugas(t);
          const IkonNilai = IKON[nilai.tingkat];
          return (
            <li key={t.nama} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <IkonNilai className={`size-4 shrink-0 ${WARNA[nilai.tingkat]}`} aria-hidden />
                  {info?.judul ?? t.nama}
                </p>
                <p className="mt-0.5 text-muted">
                  {info?.keterangan} {info?.jadwal}.
                </p>
                <p className="mt-1 text-muted">
                  {t.terakhir_at ? (
                    <>
                      Terakhir {waktuRelatif(t.terakhir_at)} ({tanggalJam(t.terakhir_at)})
                      {t.terakhir_status === "failed" ? " · gagal" : ""}
                    </>
                  ) : (
                    "Belum pernah jalan"
                  )}
                  {" · "}24 jam: {t.jalan_24j}× jalan{t.gagal_24j > 0 ? `, ${t.gagal_24j}× gagal` : ""}
                  {!t.aktif && " · dimatikan"}
                </p>
                {t.terakhir_status === "failed" && t.terakhir_pesan && (
                  <p className="mt-1 rounded-control bg-danger/10 px-3 py-2 font-mono text-xs break-words text-danger">
                    {t.terakhir_pesan}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <TombolAksi
                  aksi={jalankanTugas.bind(null, t.nama)}
                  label="Jalankan sekarang"
                  varian="kedua"
                  tampilkanPesan
                />
                <TombolAksi
                  aksi={aturTugas.bind(null, t.nama, !t.aktif)}
                  label={t.aktif ? "Matikan" : "Nyalakan"}
                  varian="netral"
                  konfirmasi={
                    t.aktif
                      ? `Matikan tugas "${info?.judul ?? t.nama}"? Tugas ini tidak akan berjalan sampai dinyalakan lagi.`
                      : undefined
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
