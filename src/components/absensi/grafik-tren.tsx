"use client";

import { useEffect, useRef, useState } from "react";

export type SeriGrafik = { nama: string; warna: string; nilai: (number | null)[] };

const TINGGI = 240;
const KIRI = 40;
const KANAN = 112;
const ATAS = 16;
const BAWAH = 28;

/**
 * Grafik garis % kehadiran per bulan (satu sumbu 0–100%). Hover/sentuh
 * menampilkan garis bantu + nilai semua seri di bulan itu; ≥2 seri diberi
 * legenda dan label langsung di ujung garis. Tabel ada di halaman.
 */
export function GrafikTren({ label, seri, judul }: { label: string[]; seri: SeriGrafik[]; judul: string }) {
  const wadah = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(640);
  const [aktif, setAktif] = useState<number | null>(null);

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLebar(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lebarPlot = lebar - KIRI - KANAN;
  const tinggiPlot = TINGGI - ATAS - BAWAH;
  const x = (i: number) => KIRI + (label.length === 1 ? lebarPlot / 2 : (i / (label.length - 1)) * lebarPlot);
  const y = (v: number) => ATAS + tinggiPlot - (v / 100) * tinggiPlot;

  // Garis putus pada bulan tanpa pertemuan.
  const jalur = (nilai: (number | null)[]) => {
    let d = "";
    let sambung = false;
    nilai.forEach((v, i) => {
      if (v === null) {
        sambung = false;
        return;
      }
      d += `${sambung ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      sambung = true;
    });
    return d;
  };

  // Label ujung: geser supaya tidak bertumpuk (jarak minimal 14px).
  const ujung = seri
    .map((s) => {
      const i = s.nilai.findLastIndex((v) => v !== null);
      return i < 0 ? null : { nama: s.nama, warna: s.warna, i, v: s.nilai[i]!, ty: y(s.nilai[i]!) };
    })
    .filter((u) => u !== null)
    .sort((a, b) => a.ty - b.ty);
  for (let k = 1; k < ujung.length; k++) {
    if (ujung[k].ty - ujung[k - 1].ty < 14) ujung[k].ty = ujung[k - 1].ty + 14;
  }

  const pilih = (clientX: number) => {
    const el = wadah.current;
    if (!el || !label.length) return;
    const px = clientX - el.getBoundingClientRect().left;
    const i = label.length === 1 ? 0 : Math.round(((px - KIRI) / lebarPlot) * (label.length - 1));
    setAktif(Math.min(label.length - 1, Math.max(0, i)));
  };

  const banyak = seri.length > 1;
  const tipX = aktif === null ? 0 : x(aktif);

  return (
    <figure className="flex flex-col gap-3">
      {banyak && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Legenda">
          {seri.map((s) => (
            <li key={s.nama} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-pill" style={{ background: s.warna }} aria-hidden />
              {s.nama}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wadah}
        className="relative touch-pan-y select-none overflow-hidden"
        onPointerMove={(e) => pilih(e.clientX)}
        onPointerDown={(e) => pilih(e.clientX)}
        onPointerLeave={() => setAktif(null)}
      >
        <svg width={lebar} height={TINGGI} role="img" aria-label={judul} className="block">
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={KIRI} x2={KIRI + lebarPlot} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={KIRI - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {v}%
              </text>
            </g>
          ))}
          {label.map((l, i) => (
            <text key={l} x={x(i)} y={TINGGI - 8} textAnchor="middle" className="fill-muted text-[11px]">
              {l}
            </text>
          ))}
          {aktif !== null && (
            <line x1={tipX} x2={tipX} y1={ATAS} y2={ATAS + tinggiPlot} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" />
          )}
          {seri.map((s) => (
            <g key={s.nama}>
              <path d={jalur(s.nilai)} fill="none" stroke={s.warna} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.nilai.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={aktif === i ? 5 : 3.5}
                    fill={s.warna}
                    className="stroke-surface"
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          ))}
          {ujung.map((u) => (
            <text key={u.nama} x={x(u.i) + 10} y={u.ty} dy="0.32em" className="fill-fg text-[11px] font-medium">
              {banyak ? `${u.nama} ${u.v}%` : `${u.v}%`}
            </text>
          ))}
        </svg>
        {aktif !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-control bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-border"
            style={tipX > lebar / 2 ? { right: lebar - tipX + 12 } : { left: tipX + 12 }}
          >
            <p className="mb-1 font-semibold">{label[aktif]}</p>
            {seri.map((s) => (
              <p key={s.nama} className="flex items-center justify-between gap-3 text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-pill" style={{ background: s.warna }} aria-hidden />
                  {s.nama}
                </span>
                <span className="font-medium text-fg tabular-nums">{s.nilai[aktif] === null ? "–" : `${s.nilai[aktif]}%`}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
