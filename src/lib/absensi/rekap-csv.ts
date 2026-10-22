import type { Rekap } from "@/lib/absensi/rekap";

const LABEL = { H: "Hadir", I: "Izin", S: "Sakit", A: "Tidak hadir", "-": "-" } as const;

function sel(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Cegah "formula injection": teks yang diawali = + - @ dibaca Excel
  // sebagai rumus, jadi diawali tanda kutip tunggal.
  // Sel "-" (bukan peserta) dibiarkan.
  if (typeof v === "string" && (/^[=+@\t\r]/.test(s) || (s.startsWith("-") && s.length > 1))) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV (pemisah titik koma + BOM UTF-8) supaya langsung rapi dibuka di Excel
 * berbahasa Indonesia dan Google Sheets. Baris atas = kop dokumen.
 */
export function rekapKeCsv(r: Rekap): string {
  const baris: (string | number | null)[][] = [
    ["Desa Kartika Wanasari · KawanKu"],
    [r.judul],
    [r.keterangan],
    [],
  ];
  const tgl = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" }).format(
      new Date(iso),
    );

  if (r.param.jenis === "sesi") {
    const id = r.kolom[0]?.id;
    baris.push(["No", "Nama", "Kode", "Kelompok", "Kategori", "Status", "Keterangan"]);
    r.baris.forEach((b, i) =>
      baris.push([i + 1, b.nama, b.kode, b.kelompok, b.kategori, LABEL[b.sel[id]], b.ket[id] ?? ""]),
    );
  } else {
    baris.push([
      "No",
      "Nama",
      "Kode",
      "Kelompok",
      ...r.kolom.map((k) => `${tgl(k.mulai)} ${k.nama}`),
      "Hadir",
      "Izin",
      "Sakit",
      "Tidak hadir",
      "Kehadiran (%)",
    ]);
    r.baris.forEach((b, i) =>
      baris.push([
        i + 1,
        b.nama,
        b.kode,
        b.kelompok,
        ...r.kolom.map((k) => b.sel[k.id]),
        b.hadir,
        b.izin,
        b.sakit,
        b.alpa,
        b.persen,
      ]),
    );
    baris.push([
      "",
      "Hadir per pertemuan",
      "",
      "",
      ...r.kolom.map((k) => k.hadir),
      r.total.hadir,
      r.total.izin,
      r.total.sakit,
      r.total.alpa,
      r.total.persen,
    ]);
    baris.push([], ["Keterangan: H hadir, I izin, S sakit, A tidak hadir, - bukan peserta pertemuan itu"]);
  }

  baris.push(
    [],
    ["Ringkasan", `Kehadiran ${r.total.persen ?? "-"}%`, `Hadir ${r.total.hadir}`, `Izin ${r.total.izin}`, `Sakit ${r.total.sakit}`, `Tidak hadir ${r.total.alpa}`],
  );
  if (r.catatan.length) {
    baris.push([], ["Catatan otomatis"], ...r.catatan.map((c) => [c]));
  }
  return "﻿" + baris.map((b) => b.map(sel).join(";")).join("\r\n");
}
