"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { ParamRekap } from "@/lib/absensi/rekap";

const LABEL = "text-sm font-medium";

/** Filter rekap (GET): bulanan atau per kegiatan. Hasilnya tampil sebagai pratinjau di bawah. */
export function FilterRekap({
  param,
  wilayah,
  sesi,
}: {
  param: ParamRekap;
  wilayah: { id: string; nama: string }[];
  sesi: { id: string; label: string }[];
}) {
  const [jenis, setJenis] = useState(param.jenis);
  return (
    <form method="get" className="grid gap-4 rounded-card bg-surface p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Jenis rekap</span>
        <select
          name="jenis"
          value={jenis}
          onChange={(e) => setJenis(e.target.value as ParamRekap["jenis"])}
          className={INPUT_CLASS}
        >
          <option value="bulan">Bulanan</option>
          <option value="sesi">Per kegiatan</option>
        </select>
      </label>

      {jenis === "bulan" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Bulan</span>
            <input type="month" name="bulan" defaultValue={param.bulan} required className={INPUT_CLASS} />
          </label>
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
        </>
      ) : (
        <label className="flex flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
          <span className={LABEL}>Kegiatan</span>
          <select name="sesi" defaultValue={param.sesi} required className={INPUT_CLASS}>
            <option value="" disabled>
              Pilih sesi…
            </option>
            {sesi.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Peserta</span>
        <select name="peserta" defaultValue={param.peserta} className={INPUT_CLASS}>
          <option value="semua">Semua jamaah</option>
          <option value="generus">Generus saja</option>
        </select>
      </label>

      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <button type="submit" className={buttonClass("utama")}>
          Tampilkan pratinjau
        </button>
      </div>
    </form>
  );
}
