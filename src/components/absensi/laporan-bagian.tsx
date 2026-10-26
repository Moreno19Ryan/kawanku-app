import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { INPUT_CLASS } from "@/components/ui/input";
import type { BarisJamaah, StatusJamaah } from "@/lib/absensi/laporan-hitung";
import type { ParamLaporan } from "@/lib/absensi/laporan";
import { FormOtomatis } from "@/components/ui/form-otomatis";

const LABEL = "text-sm font-medium";

/** Filter laporan (GET). */
export function FilterLaporan({ param, wilayah }: { param: ParamLaporan; wilayah: { id: string; nama: string }[] }) {
  return (
    <FormOtomatis className="grid gap-4 rounded-card bg-surface p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Wilayah</span>
        <select name="wilayah" defaultValue={param.wilayah} className={INPUT_CLASS}>
          {wilayah.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nama}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Peserta</span>
        <select name="peserta" defaultValue={param.peserta} className={INPUT_CLASS}>
          <option value="semua">Semua jamaah</option>
          <option value="generus">Generus saja</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Rentang</span>
        <select name="rentang" defaultValue={String(param.rentang)} className={INPUT_CLASS}>
          <option value="3">3 bulan terakhir</option>
          <option value="6">6 bulan terakhir</option>
          <option value="12">12 bulan terakhir</option>
        </select>
      </label>
    </FormOtomatis>
  );
}

/** Ubin angka utama. */
export function Ubin({ judul, nilai, keterangan }: { judul: string; nilai: string; keterangan?: string }) {
  return (
    <div className="rounded-card bg-surface p-4 sm:p-5">
      <p className="text-sm text-muted">{judul}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-muted">{keterangan}</p>}
    </div>
  );
}

/** Batang horizontal % (satu ukuran, 0–100) dengan label nilai di samping. */
export function DaftarBatang({ isi }: { isi: { nama: string; persen: number | null; keterangan: string }[] }) {
  if (!isi.length) return <p className="text-sm text-muted">Belum ada data.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {isi.map((x) => (
        <li key={x.nama} title={`${x.nama}: ${x.persen ?? "–"}% · ${x.keterangan}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{x.nama}</span>
            <span className="shrink-0 tabular-nums">{x.persen === null ? "–" : `${x.persen}%`}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-pill bg-surface-muted">
            <div className="h-2 rounded-pill bg-primary" style={{ width: `${x.persen ?? 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{x.keterangan}</p>
        </li>
      ))}
    </ul>
  );
}

export const LABEL_STATUS: Record<StatusJamaah, { label: string; nada: "utama" | "netral" | "sukses" | "bahaya" }> = {
  perlu_disapa: { label: "Perlu disapa", nada: "bahaya" },
  menurun: { label: "Menurun", nada: "bahaya" },
  mulai_jarang: { label: "Mulai jarang", nada: "utama" },
  jarang: { label: "Jarang hadir", nada: "netral" },
  rajin: { label: "Rajin", nada: "sukses" },
  biasa: { label: "Biasa", nada: "netral" },
};

function tanggalPendek(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

/** Tabel jamaah + tab status (tautan GET). */
export function TabelJamaah({
  baris,
  hitung,
  param,
  tautan,
}: {
  baris: BarisJamaah[];
  hitung: Record<StatusJamaah | "semua", number>;
  param: ParamLaporan;
  tautan: (status: ParamLaporan["status"]) => string;
}) {
  const tab: ParamLaporan["status"][] = ["semua", "perlu_disapa", "menurun", "mulai_jarang", "jarang", "rajin"];
  const tampil = param.status === "semua" ? baris : baris.filter((b) => b.status === param.status);
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Saring status">
        {tab.map((t) => {
          const pilih = t === param.status;
          return (
            <Link
              key={t}
              href={tautan(t)}
              scroll={false}
              aria-current={pilih ? "page" : undefined}
              className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
                pilih ? "bg-primary text-primary-fg" : "bg-surface-muted text-muted hover:text-fg"
              }`}
            >
              {t === "semua" ? "Semua" : LABEL_STATUS[t].label} <span className="tabular-nums opacity-80">{hitung[t]}</span>
            </Link>
          );
        })}
      </nav>
      {tampil.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Tidak ada jamaah di kelompok status ini.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium sm:px-6">Nama</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Hadir</th>
                <th className="px-3 py-2 text-right font-medium">Izin/sakit</th>
                <th className="px-3 py-2 text-right font-medium">Tidak hadir</th>
                <th className="px-3 py-2 text-right font-medium">Tren</th>
                <th className="px-5 py-2 font-medium sm:px-6">Terakhir hadir</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 sm:px-6">
                    <Link href={`/jamaah/${b.id}`} className="font-medium hover:text-primary">
                      {b.nama}
                    </Link>
                    <p className="text-xs text-muted">
                      {b.kelompok}
                      {b.kategori ? ` · ${b.kategori}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge nada={LABEL_STATUS[b.status].nada}>{LABEL_STATUS[b.status].label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="font-medium">{b.persen ?? "–"}%</span>
                    <span className="text-xs text-muted">
                      {" "}
                      ({b.hadir}/{b.kesempatan})
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{b.izin + b.sakit}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{b.alpa}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {b.tren === null ? "–" : b.tren > 0 ? `▲ ${b.tren}` : b.tren < 0 ? `▼ ${-b.tren}` : "0"}
                  </td>
                  <td className="px-5 py-2.5 text-muted sm:px-6">{b.terakhirHadir ? tanggalPendek(b.terakhirHadir) : "Belum pernah"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
