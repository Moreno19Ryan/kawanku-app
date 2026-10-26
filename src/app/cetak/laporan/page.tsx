import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { TombolCetak } from "@/components/absensi/tombol-cetak";
import { KopDokumen } from "@/components/dokumen/kop-dokumen";
import { bulanWib, daftarBulan, namaBulan } from "@/lib/absensi/laporan-hitung";
import { bacaParamLaporan, getLaporan } from "@/lib/absensi/laporan";
import { getSapaanTerakhir } from "@/lib/absensi/sapaan";
import { getAksesKegiatan } from "@/lib/kegiatan/akses";
import { getRekapPengajar } from "@/lib/kegiatan/rekap-pengajar";
import { tanggalJam } from "@/lib/waktu";

export const metadata: Metadata = {
  title: "Laporan bulanan",
  robots: { index: false },
};

/** Laporan bulanan kehadiran & kegiatan (A4 tegak, di luar layout admin). */
export default function CetakLaporanPage({ searchParams }: PageProps<"/cetak/laporan">) {
  return (
    <div className="min-h-dvh bg-paper px-gutter py-8 text-paper-fg print:p-0">
      <Suspense fallback={<p className="text-sm">Menyiapkan laporan…</p>}>
        <Lembar cari={searchParams} />
      </Suspense>
    </div>
  );
}

const persen = (n: number | null) => (n === null ? "–" : `${n}%`);

function daftarNama(nama: string[], maks = 12): string {
  if (nama.length <= maks) return nama.join(", ");
  return `${nama.slice(0, maks).join(", ")}, dan ${nama.length - maks} lainnya`;
}

async function Lembar({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const q = await cari;
  const pilihan = daftarBulan(12);
  const bulan = typeof q.bulan === "string" && pilihan.includes(q.bulan) ? q.bulan : bulanWib(new Date().toISOString());
  const hasil = await getLaporan(bacaParamLaporan(q), { bulan });
  if (!hasil) return <p className="text-sm">Kamu tidak punya izin melihat laporan kehadiran.</p>;
  const { laporan: l, namaWilayah, param } = hasil;

  const perlu = l.jamaah.filter((b) => b.status === "perlu_disapa");
  const rajin = l.jamaah.filter((b) => b.status === "rajin");
  const [sapaan, kegiatan] = await Promise.all([getSapaanTerakhir(perlu.map((b) => b.id)), getAksesKegiatan()]);
  const pengajar = kegiatan?.kelompokLihat.length
    ? await getRekapPengajar(bulan, new Map(kegiatan.kelompokFitur.map((k) => [k.id, k.nama])))
    : [];
  const peserta = param.peserta === "generus" ? "generus" : "jamaah";

  return (
    <div className="mx-auto flex max-w-[190mm] flex-col gap-6 print:max-w-none">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-paper-muted">
          Pratinjau cetak. Pilih &ldquo;Simpan sebagai PDF&rdquo; di jendela cetak untuk membuat PDF.
        </p>
        <TombolCetak />
      </div>

      <article className="flex flex-col gap-5 bg-paper text-[10pt] text-paper-fg">
        <KopDokumen
          judul="Laporan Bulanan Kehadiran & Kegiatan"
          keterangan={`${namaWilayah} · ${namaBulan(bulan)}${param.peserta === "generus" ? " · generus" : ""}`}
          hitamPutih
        />

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
          {[
            { l: "Rata-rata kehadiran", v: persen(l.ringkas.persen) },
            { l: "Pertemuan", v: l.ringkas.pertemuan },
            { l: `Rajin (${peserta})`, v: l.ringkas.rajin },
            { l: "Perlu disapa", v: l.ringkas.perluDisapa },
          ].map((x) => (
            <div key={x.l} className="rounded-[2mm] border border-paper-muted/40 px-3 py-2">
              <p className="text-[8pt] text-paper-muted">{x.l}</p>
              <p className="text-[14pt] font-bold leading-tight">{x.v}</p>
            </div>
          ))}
        </section>

        {l.sorotan.length > 0 && (
          <section className="rounded-[2mm] border border-paper-muted/40 px-4 py-3 break-inside-avoid">
            <p className="mb-1.5 flex items-center gap-1.5 text-[9pt] font-semibold">
              <Sparkles className="size-3.5" aria-hidden />
              Sorotan
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[9pt] leading-snug">
              {l.sorotan.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="break-inside-avoid">
          <h2 className="mb-1.5 text-[11pt] font-semibold">Kehadiran per kegiatan</h2>
          {l.perKegiatan.length === 0 ? (
            <p className="text-paper-muted">Belum ada pertemuan berabsensi di bulan ini.</p>
          ) : (
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr className="border-y-2 border-paper-fg text-left">
                  <th className="py-1.5 pr-2">Kegiatan</th>
                  <th className="py-1.5 pr-2 text-right">Pertemuan</th>
                  <th className="py-1.5 text-right">Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {l.perKegiatan.map((k) => (
                  <tr key={k.nama} className="border-b border-paper-muted/30">
                    <td className="py-1 pr-2">{k.nama}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{k.pertemuan}</td>
                    <td className="py-1 text-right tabular-nums">{persen(k.persen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {l.seri.length > 1 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1.5 text-[11pt] font-semibold">Kehadiran per kelompok</h2>
            <table className="w-full border-collapse text-[9pt]">
              <tbody>
                {l.seri.map((s) => (
                  <tr key={s.id} className="border-b border-paper-muted/30">
                    <td className="py-1 pr-2">{s.nama}</td>
                    <td className="py-1 text-right tabular-nums">{persen(s.persen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {l.perKategori.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1.5 text-[11pt] font-semibold">Kehadiran per kategori</h2>
            <table className="w-full border-collapse text-[9pt]">
              <tbody>
                {l.perKategori.map((k) => (
                  <tr key={k.nama} className="border-b border-paper-muted/30">
                    <td className="py-1 pr-2">{k.nama}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{k.jumlah} orang</td>
                    <td className="py-1 text-right tabular-nums">{persen(k.persen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {pengajar.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1.5 text-[11pt] font-semibold">Pengajar bulan ini</h2>
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr className="border-y-2 border-paper-fg text-left">
                  <th className="py-1.5 pr-2">Pemateri</th>
                  <th className="py-1.5 pr-2 text-right">Sesi</th>
                  <th className="py-1.5 pr-2">Kegiatan</th>
                  <th className="py-1.5">Materi terakhir</th>
                </tr>
              </thead>
              <tbody>
                {pengajar.map((p) => (
                  <tr key={p.nama} className="border-b border-paper-muted/30 align-top">
                    <td className="py-1 pr-2">{p.nama}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.sesi}</td>
                    <td className="py-1 pr-2">{p.kegiatan.join(", ")}</td>
                    <td className="py-1">{p.materi.join(" · ") || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="break-inside-avoid">
          <h2 className="mb-1.5 text-[11pt] font-semibold">Tindak lanjut</h2>
          {perlu.length === 0 ? (
            <p>Alhamdulillah, tidak ada {peserta} yang tidak hadir 3 pertemuan berturut-turut.</p>
          ) : (
            <>
              <p className="mb-1">
                {perlu.length} {peserta} perlu disapa, {perlu.filter((b) => sapaan.has(b.id)).length} di antaranya sudah
                disapa:
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-[9pt]">
                {perlu.map((b) => {
                  const s = sapaan.get(b.id);
                  return (
                    <li key={b.id}>
                      {b.nama} ({b.kelompok}){s ? ` · disapa ${tanggalJam(s.created_at)}${s.catatan ? `: ${s.catatan}` : ""}` : " · belum disapa"}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {rajin.length > 0 && (
            <p className="mt-2">
              <span className="font-semibold">MasyaAllah, rajin hadir:</span> {daftarNama(rajin.map((b) => b.nama))}.
            </p>
          )}
        </section>

        <footer className="mt-2 border-t border-paper-muted/40 pt-3 text-[9pt] text-paper-muted">
          <p className="text-paper-fg">
            Alhamdulillah Jazakumullahu Khoiro atas amal sholih seluruh pengurus dan jamaah.
          </p>
          <p>Disusun otomatis oleh KawanKu · {tanggalJam(new Date().toISOString())}</p>
        </footer>
      </article>
    </div>
  );
}
