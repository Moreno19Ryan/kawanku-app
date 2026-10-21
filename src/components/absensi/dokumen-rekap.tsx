import { Sparkles } from "lucide-react";
import { KopDokumen } from "@/components/dokumen/kop-dokumen";
import type { Rekap, Sel } from "@/lib/absensi/rekap";
import { tanggalJam } from "@/lib/waktu";

const LABEL_SEL: Record<Sel, string> = { H: "Hadir", I: "Izin", S: "Sakit", A: "Tidak hadir", "-": "—" };
const WARNA_SEL: Record<Sel, string> = {
  H: "font-semibold",
  I: "",
  S: "",
  A: "text-paper-muted",
  "-": "text-paper-muted/60",
};

function tglKolom(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "numeric", timeZone: "Asia/Jakarta" }).format(
    new Date(iso),
  );
}

/**
 * Dokumen rekap absensi (kertas putih, dengan KopDokumen). Dipakai untuk
 * pratinjau di aplikasi dan halaman cetak, supaya hasil cetak sama persis
 * dengan pratinjau.
 */
export function DokumenRekap({ rekap, dicetak }: { rekap: Rekap; dicetak?: string }) {
  const { kolom, baris, total, param } = rekap;
  const perSesi = param.jenis === "sesi";
  const banyakKelompok = new Set(baris.map((b) => b.kelompok)).size > 1;
  const sesiId = kolom[0]?.id;

  return (
    <article className="flex flex-col gap-5 bg-paper text-paper-fg">
      <KopDokumen judul={rekap.judul} keterangan={rekap.keterangan} hitamPutih />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5 print:grid-cols-5">
        {[
          { l: "Kehadiran", v: total.persen === null ? "–" : `${total.persen}%` },
          { l: "Hadir", v: total.hadir },
          { l: "Izin", v: total.izin },
          { l: "Sakit", v: total.sakit },
          { l: "Tidak hadir", v: total.alpa },
        ].map((s) => (
          <div key={s.l} className="rounded-[2mm] border border-paper-muted/40 px-3 py-2">
            <p className="text-[8pt] text-paper-muted">{s.l}</p>
            <p className="text-[14pt] font-bold leading-tight">{s.v}</p>
          </div>
        ))}
      </section>

      {rekap.catatan.length > 0 && (
        <section className="rounded-[2mm] border border-paper-muted/40 px-4 py-3 break-inside-avoid">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9pt] font-semibold">
            <Sparkles className="size-3.5" aria-hidden />
            Catatan otomatis
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[9pt] leading-snug">
            {rekap.catatan.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {baris.length === 0 ? (
        <p className="text-[10pt] text-paper-muted">Tidak ada peserta untuk rekap ini.</p>
      ) : perSesi ? (
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr className="border-y-2 border-paper-fg text-left">
              <th className="w-8 py-1.5 pr-2">No</th>
              <th className="py-1.5 pr-2">Nama</th>
              <th className="py-1.5 pr-2">Kode</th>
              {banyakKelompok && <th className="py-1.5 pr-2">Kelompok</th>}
              <th className="py-1.5 pr-2">Kategori</th>
              <th className="py-1.5 pr-2">Status</th>
              <th className="py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={b.id} className="border-b border-paper-muted/30 break-inside-avoid">
                <td className="py-1 pr-2 text-paper-muted">{i + 1}</td>
                <td className="py-1 pr-2 font-medium">{b.nama}</td>
                <td className="py-1 pr-2 font-mono text-[8pt]">{b.kode}</td>
                {banyakKelompok && <td className="py-1 pr-2">{b.kelompok}</td>}
                <td className="py-1 pr-2">{b.kategori ?? "-"}</td>
                <td className={`py-1 pr-2 ${WARNA_SEL[b.sel[sesiId]]}`}>{LABEL_SEL[b.sel[sesiId]]}</td>
                <td className="py-1 text-paper-muted">{b.ket[sesiId] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="border-y-2 border-paper-fg">
                <th className="w-7 py-1.5 pr-1 text-left">No</th>
                <th className="py-1.5 pr-2 text-left">Nama</th>
                {banyakKelompok && <th className="py-1.5 pr-2 text-left">Kelompok</th>}
                {kolom.map((k) => (
                  <th key={k.id} title={k.nama} className="px-1 py-1.5 text-center font-semibold whitespace-nowrap">
                    {tglKolom(k.mulai)}
                  </th>
                ))}
                <th className="border-l border-paper-muted/40 px-1 py-1.5 text-center">H</th>
                <th className="px-1 py-1.5 text-center">I</th>
                <th className="px-1 py-1.5 text-center">S</th>
                <th className="px-1 py-1.5 text-center">A</th>
                <th className="px-1 py-1.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={b.id} className="border-b border-paper-muted/30 break-inside-avoid">
                  <td className="py-0.5 pr-1 text-paper-muted">{i + 1}</td>
                  <td className="py-0.5 pr-2 font-medium whitespace-nowrap">{b.nama}</td>
                  {banyakKelompok && <td className="py-0.5 pr-2 whitespace-nowrap">{b.kelompok}</td>}
                  {kolom.map((k) => (
                    <td key={k.id} className={`px-1 py-0.5 text-center ${WARNA_SEL[b.sel[k.id]]}`}>
                      {b.sel[k.id] === "-" ? "·" : b.sel[k.id]}
                    </td>
                  ))}
                  <td className="border-l border-paper-muted/40 px-1 py-0.5 text-center font-semibold">{b.hadir}</td>
                  <td className="px-1 py-0.5 text-center">{b.izin}</td>
                  <td className="px-1 py-0.5 text-center">{b.sakit}</td>
                  <td className="px-1 py-0.5 text-center">{b.alpa}</td>
                  <td className="px-1 py-0.5 text-right font-semibold">{b.persen ?? "–"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-paper-fg">
                <td colSpan={banyakKelompok ? 3 : 2} className="py-1 pr-2 font-semibold">
                  Hadir per pertemuan
                </td>
                {kolom.map((k) => (
                  <td key={k.id} className="px-1 py-1 text-center font-semibold">
                    {k.hadir}
                  </td>
                ))}
                <td className="border-l border-paper-muted/40 px-1 py-1 text-center font-semibold">{total.hadir}</td>
                <td className="px-1 py-1 text-center">{total.izin}</td>
                <td className="px-1 py-1 text-center">{total.sakit}</td>
                <td className="px-1 py-1 text-center">{total.alpa}</td>
                <td className="px-1 py-1 text-right font-semibold">{total.persen ?? "–"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!perSesi && kolom.length > 0 && (
        <section className="text-[8pt] text-paper-muted break-inside-avoid">
          <p className="mb-1 font-semibold text-paper-fg">Daftar pertemuan</p>
          <ol className="columns-1 gap-6 sm:columns-2 print:columns-2">
            {kolom.map((k) => (
              <li key={k.id}>
                {tglKolom(k.mulai)}: {k.nama} ({k.hadir}/{k.peserta} hadir)
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="flex flex-wrap justify-between gap-2 border-t border-paper-muted/40 pt-2 text-[7.5pt] text-paper-muted">
        <span>
          {perSesi
            ? "Status dari catatan absensi KawanKu (scan kartu, QR layar, atau dicatat admin)."
            : "H hadir · I izin · S sakit · A tidak hadir · · bukan peserta pertemuan itu · % = hadir ÷ pertemuan yang diikuti"}
        </span>
        <span>{dicetak ? `Dicetak ${tanggalJam(dicetak)} · KawanKu` : "KawanKu"}</span>
      </footer>
    </article>
  );
}
