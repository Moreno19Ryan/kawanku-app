"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/ui/input";

type Wilayah = { kode: string; nama: string };

const TINGKAT = ["Provinsi", "Kabupaten/Kota", "Kecamatan", "Desa/Kelurahan"] as const;

/** Daftar wilayah di bawah `induk` ("" = provinsi), di-cache per halaman. */
const cache = new Map<string, Promise<Wilayah[]>>();
function ambil(induk: string): Promise<Wilayah[]> {
  let p = cache.get(induk);
  if (!p) {
    p = fetch(`/api/wilayah?induk=${encodeURIComponent(induk)}`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    cache.set(induk, p);
    p.then((d) => d.length === 0 && cache.delete(induk));
  }
  return p;
}

/** "32.16.07.1001" → ["32", "32.16", "32.16.07", "32.16.07.1001"]. */
function rantai(kode: string | null): string[] {
  if (!kode) return [];
  const potong = kode.split(".");
  return potong.map((_, i) => potong.slice(0, i + 1).join("."));
}

/**
 * Provinsi → kab/kota → kecamatan → desa/kelurahan (data Kemendagri), semua
 * kosong di awal. Mengirim kode terdalam yang dipilih lewat input `name`.
 */
export function PilihWilayah({ name, awal }: { name: string; awal: string | null }) {
  const [pilihan, setPilihan] = useState<string[]>(() => rantai(awal));
  const [daftar, setDaftar] = useState<(Wilayah[] | null)[]>([null, null, null, null]);

  useEffect(() => {
    let batal = false;
    const induk = ["", ...pilihan].slice(0, 4);
    Promise.all(induk.map((k, i) => (i === 0 || pilihan[i - 1] ? ambil(k) : Promise.resolve(null)))).then(
      (hasil) => !batal && setDaftar(hasil),
    );
    return () => {
      batal = true;
    };
  }, [pilihan]);

  function ubah(tingkat: number, kode: string) {
    setPilihan((p) => (kode ? [...p.slice(0, tingkat), kode] : p.slice(0, tingkat)));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name={name} value={pilihan.at(-1) ?? ""} />
      {TINGKAT.map((label, i) => {
        const opsi = daftar[i];
        const aktif = i === 0 || Boolean(pilihan[i - 1]);
        return (
          <label key={label} className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{label}</span>
            <select
              value={pilihan[i] ?? ""}
              onChange={(e) => ubah(i, e.target.value)}
              disabled={!aktif || !opsi}
              className={`${INPUT_CLASS} w-full`}
            >
              <option value="">{aktif && !opsi ? "Memuat…" : `Pilih ${label.toLowerCase()}`}</option>
              {opsi?.map((w) => (
                <option key={w.kode} value={w.kode}>
                  {w.nama}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
