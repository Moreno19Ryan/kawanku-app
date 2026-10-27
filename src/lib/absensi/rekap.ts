import "server-only";
import { getAksesAbsensi, KOLOM_SESI, type AksesAbsensi, type Sesi } from "@/lib/absensi/akses";
import { LABEL_ALASAN_IZIN, ucapanSyukur } from "@/lib/label";
import { createClient } from "@/lib/supabase/server";
import { jam } from "@/lib/waktu";

/**
 * Rekap absensi (per kegiatan/sesi atau bulanan) untuk pratinjau, cetak,
 * dan ekspor. Semua data dibaca dengan sesi admin (RLS): admin generus hanya
 * melihat generus, admin kelompok hanya kelompoknya.
 */

export type Sel = "H" | "I" | "S" | "A" | "-";

export type ParamRekap = {
  jenis: "bulan" | "sesi";
  /** YYYY-MM (WIB). */
  bulan: string;
  /** "desa" atau id kelompok. */
  wilayah: string;
  peserta: "semua" | "generus";
  sesi: string;
};

export type KolomRekap = { id: string; nama: string; mulai: string; hadir: number; peserta: number };

export type BarisRekap = {
  id: string;
  nama: string;
  kode: string;
  kelompok: string;
  kategori: string | null;
  sel: Record<string, Sel>;
  /** Keterangan per sesi (alasan izin, jam, jalur). */
  ket: Record<string, string>;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  peserta: number;
  persen: number | null;
};

export type Rekap = {
  param: ParamRekap;
  judul: string;
  keterangan: string;
  kolom: KolomRekap[];
  baris: BarisRekap[];
  total: { hadir: number; izin: number; sakit: number; alpa: number; peserta: number; persen: number | null };
  catatan: string[];
  /** Nama file ekspor tanpa ekstensi. */
  namaFile: string;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function bulanIni(): string {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", timeZone: "Asia/Jakarta" })
    .format(new Date())
    .slice(0, 7);
}

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Baca parameter rekap dari URL (dipakai halaman pratinjau, cetak, dan ekspor). */
export function bacaParamRekap(cari: Record<string, string | string[] | undefined>): ParamRekap {
  const bulan = satu(cari.bulan);
  return {
    jenis: satu(cari.jenis) === "sesi" ? "sesi" : "bulan",
    bulan: /^\d{4}-(0[1-9]|1[0-2])$/.test(bulan) ? bulan : bulanIni(),
    wilayah: satu(cari.wilayah),
    peserta: satu(cari.peserta) === "generus" ? "generus" : "semua",
    sesi: /^[0-9a-f-]{36}$/.test(satu(cari.sesi)) ? satu(cari.sesi) : "",
  };
}

export function queryRekap(p: ParamRekap): string {
  const q = new URLSearchParams({ jenis: p.jenis, bulan: p.bulan, wilayah: p.wilayah, peserta: p.peserta });
  if (p.sesi) q.set("sesi", p.sesi);
  return q.toString();
}

export function namaBulan(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return `${BULAN[m - 1]} ${y}`;
}

function rentangBulan(bulan: string): [string, string] {
  const [y, m] = bulan.split("-").map(Number);
  const akhir = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [`${bulan}-01T00:00:00+07:00`, `${akhir}-01T00:00:00+07:00`];
}

function bulanSebelum(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

function tanggal(iso: string, opsi: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("id-ID", { ...opsi, timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function daftarNama(nama: string[], maks = 5): string {
  if (nama.length <= maks) return nama.join(", ");
  return `${nama.slice(0, maks).join(", ")}, dan ${nama.length - maks} lainnya`;
}

type Jamaah = {
  id: string;
  kode: string;
  nama_lengkap: string;
  kelompok_id: string;
  kategori_jamaah_nama: string | null;
  termasuk_generus: boolean;
};
type Catatan = {
  sesi_id: string;
  jamaah_id: string;
  status: "hadir" | "izin" | "sakit";
  alasan_izin: string | null;
  jalur: string;
  dicatat_at: string;
};

const KOLOM_JAMAAH = "id, kode, nama_lengkap, kelompok_id, kategori_jamaah_nama, termasuk_generus";

/** Hitung matriks hadir/izin/sakit/tidak hadir untuk daftar sesi & peserta. */
function hitung(sesi: Sesi[], jamaah: Jamaah[], catatan: Catatan[], namaKelompok: Map<string, string>) {
  const peta = new Map(catatan.map((c) => [`${c.sesi_id}:${c.jamaah_id}`, c]));
  const kolom: KolomRekap[] = sesi.map((s) => ({ id: s.id, nama: s.nama, mulai: s.mulai, hadir: 0, peserta: 0 }));
  const baris: BarisRekap[] = jamaah.map((j) => {
    const b: BarisRekap = {
      id: j.id,
      nama: j.nama_lengkap,
      kode: j.kode,
      kelompok: namaKelompok.get(j.kelompok_id) ?? "",
      kategori: j.kategori_jamaah_nama,
      sel: {},
      ket: {},
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpa: 0,
      peserta: 0,
      persen: null,
    };
    sesi.forEach((s, i) => {
      const c = peta.get(`${s.id}:${j.id}`);
      const ikut =
        Boolean(c) ||
        ((s.kelompok_id === null || s.kelompok_id === j.kelompok_id) && (!s.hanya_generus || j.termasuk_generus));
      if (!ikut) {
        b.sel[s.id] = "-";
        return;
      }
      b.peserta++;
      kolom[i].peserta++;
      if (!c) {
        b.sel[s.id] = "A";
        b.alpa++;
        return;
      }
      if (c.status === "hadir") {
        b.sel[s.id] = "H";
        b.hadir++;
        kolom[i].hadir++;
        b.ket[s.id] = `${jam(c.dicatat_at)} · ${c.jalur === "kartu" ? "kartu" : c.jalur === "layar" ? "QR layar" : "admin"}`;
      } else if (c.status === "izin") {
        b.sel[s.id] = "I";
        b.izin++;
        b.ket[s.id] = `Izin: ${LABEL_ALASAN_IZIN[c.alasan_izin ?? ""]?.toLowerCase() ?? "-"}`;
      } else {
        b.sel[s.id] = "S";
        b.sakit++;
        b.ket[s.id] = "Sakit";
      }
    });
    b.persen = persen(b.hadir, b.peserta);
    return b;
  });
  const total = baris.reduce(
    (t, b) => ({
      hadir: t.hadir + b.hadir,
      izin: t.izin + b.izin,
      sakit: t.sakit + b.sakit,
      alpa: t.alpa + b.alpa,
      peserta: t.peserta + b.peserta,
    }),
    { hadir: 0, izin: 0, sakit: 0, alpa: 0, peserta: 0 },
  );
  return {
    kolom,
    baris: baris.filter((b) => b.peserta > 0),
    total: { ...total, persen: persen(total.hadir, total.peserta) },
  };
}

/** Wilayah yang boleh dipilih untuk rekap. */
export function pilihanWilayah(akses: AksesAbsensi) {
  return [
    ...(akses.lihatSeluruhDesa ? [{ id: "desa", nama: "Seluruh desa" }] : []),
    ...akses.kelompokLihat.map((k) => ({ id: k.id, nama: k.nama })),
  ];
}

/** Boleh mencetak/mengekspor rekap: pengelola absensi (pengembang hanya lihat, tidak menarik data). */
export function bolehEksporRekap(akses: AksesAbsensi): boolean {
  return akses.kelompokKelola.length > 0;
}

export async function getRekap(
  param: ParamRekap,
  opsi: { ekspor?: boolean } = {},
): Promise<Rekap | { galat: string } | null> {
  const akses = await getAksesAbsensi();
  if (!akses?.bolehLihat) return null;
  if (opsi.ekspor && !bolehEksporRekap(akses)) return null;
  const supabase = await createClient();
  const namaKelompok = new Map(akses.kelompokFitur.map((k) => [k.id, k.nama]));
  const wilayahSah = pilihanWilayah(akses);
  const p = { ...param, wilayah: wilayahSah.some((w) => w.id === param.wilayah) ? param.wilayah : wilayahSah[0].id };

  // --- Sesi -----------------------------------------------------------
  let sesi: Sesi[];
  if (p.jenis === "sesi") {
    if (!p.sesi) return { galat: "Pilih kegiatan (sesi) yang ingin direkap." };
    const { data } = await supabase.from("sesi_absensi").select(KOLOM_SESI).eq("id", p.sesi).maybeSingle<Sesi>();
    if (!data) return { galat: "Sesi tidak ditemukan atau di luar wewenang akun ini." };
    sesi = [data];
  } else {
    const [awal, akhir] = rentangBulan(p.bulan);
    let q = supabase.from("sesi_absensi").select(KOLOM_SESI).gte("mulai", awal).lt("mulai", akhir).order("mulai");
    q =
      p.wilayah === "desa"
        ? q.or(`kelompok_id.is.null,kelompok_id.in.(${akses.kelompokLihat.map((k) => k.id).join(",")})`)
        : q.or(`kelompok_id.is.null,kelompok_id.eq.${p.wilayah}`);
    const { data } = await q.returns<Sesi[]>();
    sesi = data ?? [];
  }

  // --- Peserta & catatan ----------------------------------------------
  const kelompokIds =
    p.jenis === "sesi" && sesi[0].kelompok_id
      ? [sesi[0].kelompok_id]
      : p.wilayah === "desa"
        ? akses.kelompokLihat.map((k) => k.id)
        : [p.wilayah];
  const generusSaja = p.peserta === "generus";
  let qj = supabase
    .from("jamaah_dengan_kategori")
    .select(KOLOM_JAMAAH)
    .eq("aktif", true)
    .in("kelompok_id", kelompokIds)
    .order("nama_lengkap");
  if (generusSaja) qj = qj.eq("termasuk_generus", true);
  const [{ data: jamaah }, { data: catatan }] = await Promise.all([
    qj.returns<Jamaah[]>(),
    sesi.length
      ? supabase
          .from("absensi")
          .select("sesi_id, jamaah_id, status, alasan_izin, jalur, dicatat_at")
          .in(
            "sesi_id",
            sesi.map((s) => s.id),
          )
          .returns<Catatan[]>()
      : Promise.resolve({ data: [] as Catatan[] }),
  ]);
  const daftar = [...(jamaah ?? [])];
  // Jamaah yang punya catatan tapi kini nonaktif tetap masuk rekap.
  const kurang = [...new Set((catatan ?? []).map((c) => c.jamaah_id))].filter((id) => !daftar.some((j) => j.id === id));
  if (kurang.length) {
    let qk = supabase.from("jamaah_dengan_kategori").select(KOLOM_JAMAAH).in("id", kurang).in("kelompok_id", kelompokIds);
    if (generusSaja) qk = qk.eq("termasuk_generus", true);
    const { data } = await qk.returns<Jamaah[]>();
    daftar.push(...(data ?? []));
    daftar.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, "id"));
  }
  const idPeserta = new Set(daftar.map((j) => j.id));
  const { kolom, baris, total } = hitung(
    sesi,
    daftar,
    (catatan ?? []).filter((c) => idPeserta.has(c.jamaah_id)),
    namaKelompok,
  );

  // --- Judul ------------------------------------------------------------
  const namaWilayah =
    p.jenis === "sesi"
      ? sesi[0].kelompok_id
        ? (namaKelompok.get(sesi[0].kelompok_id) ?? "Kelompok")
        : "Seluruh desa"
      : (wilayahSah.find((w) => w.id === p.wilayah)?.nama ?? "");
  const pesertaLabel = generusSaja || (p.jenis === "sesi" && sesi[0].hanya_generus) ? "Generus" : "Semua jamaah";
  const judul = p.jenis === "sesi" ? `Rekap Absensi: ${sesi[0].nama}` : `Rekap Absensi ${namaBulan(p.bulan)}`;
  const keterangan =
    p.jenis === "sesi"
      ? `${tanggal(sesi[0].mulai, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${namaWilayah} · ${pesertaLabel}`
      : `${namaWilayah} · ${pesertaLabel} · ${kolom.length} pertemuan`;
  const namaFile = (p.jenis === "sesi" ? `rekap-${sesi[0].nama}-${tanggal(sesi[0].mulai, { dateStyle: "short" })}` : `rekap-${p.bulan}-${namaWilayah}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // --- Catatan otomatis ---------------------------------------------------
  const catatanOtomatis: string[] = [];
  if (kolom.length === 0) {
    catatanOtomatis.push(`Belum ada sesi absensi di ${namaBulan(p.bulan)} untuk wilayah ini.`);
  } else if (total.peserta > 0) {
    if (p.jenis === "sesi") {
      catatanOtomatis.push(
        `Kehadiran ${total.persen}%: ${total.hadir} hadir, ${total.izin} izin, ${total.sakit} sakit, ${total.alpa} tidak hadir dari ${total.peserta} peserta.`,
      );
      if (!sesi[0].kelompok_id) {
        const perKelompok = [...new Set(baris.map((b) => b.kelompok))]
          .map((k) => {
            const bs = baris.filter((b) => b.kelompok === k);
            return { k, p: persen(bs.reduce((n, b) => n + b.hadir, 0), bs.length) ?? 0 };
          })
          .sort((a, b) => b.p - a.p);
        if (perKelompok.length > 1) {
          catatanOtomatis.push(
            `Kehadiran per kelompok: ${perKelompok.map((x) => `${x.k} ${x.p}%`).join(", ")}. Tertinggi ${perKelompok[0].k}.`,
          );
        }
      }
      // Bandingkan dengan pertemuan sebelumnya di wilayah & sasaran yang sama.
      let qs = supabase
        .from("sesi_absensi")
        .select("id, nama, mulai")
        .lt("mulai", sesi[0].mulai)
        .eq("hanya_generus", sesi[0].hanya_generus)
        .order("mulai", { ascending: false })
        .limit(1);
      qs = sesi[0].kelompok_id ? qs.eq("kelompok_id", sesi[0].kelompok_id) : qs.is("kelompok_id", null);
      const { data: lalu } = await qs.maybeSingle<{ id: string; nama: string; mulai: string }>();
      if (lalu) {
        const { count } = await supabase
          .from("absensi")
          .select("id", { count: "exact", head: true })
          .eq("sesi_id", lalu.id)
          .eq("status", "hadir");
        const selisih = total.hadir - (count ?? 0);
        catatanOtomatis.push(
          selisih === 0
            ? `Jumlah hadir sama dengan pertemuan sebelumnya (${lalu.nama}, ${tanggal(lalu.mulai)}).`
            : `Jumlah hadir ${selisih > 0 ? "naik" : "turun"} ${Math.abs(selisih)} orang dibanding pertemuan sebelumnya (${lalu.nama}, ${tanggal(lalu.mulai)}).`,
        );
      }
      const izin = baris.filter((b) => b.sel[sesi[0].id] === "I").map((b) => b.ket[sesi[0].id]);
      if (izin.length) {
        const alasan = Object.entries(
          izin.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
        ).sort((a, b) => b[1] - a[1])[0];
        catatanOtomatis.push(`Alasan izin terbanyak: ${alasan[0].replace("Izin: ", "")} (${alasan[1]} orang).`);
      }
    } else {
      catatanOtomatis.push(
        `Rata-rata kehadiran ${total.persen}% dari ${kolom.length} pertemuan (${total.hadir} kehadiran dari ${total.peserta} kesempatan).`,
      );
      // Bandingkan dengan bulan sebelumnya.
      const [awalLalu, akhirLalu] = rentangBulan(bulanSebelum(p.bulan));
      let ql = supabase.from("sesi_absensi").select(KOLOM_SESI).gte("mulai", awalLalu).lt("mulai", akhirLalu);
      ql =
        p.wilayah === "desa"
          ? ql.or(`kelompok_id.is.null,kelompok_id.in.(${akses.kelompokLihat.map((k) => k.id).join(",")})`)
          : ql.or(`kelompok_id.is.null,kelompok_id.eq.${p.wilayah}`);
      const { data: sesiLalu } = await ql.returns<Sesi[]>();
      if (sesiLalu?.length) {
        const { data: catLalu } = await supabase
          .from("absensi")
          .select("sesi_id, jamaah_id, status, alasan_izin, jalur, dicatat_at")
          .in(
            "sesi_id",
            sesiLalu.map((s) => s.id),
          )
          .returns<Catatan[]>();
        const lalu = hitung(sesiLalu, daftar, (catLalu ?? []).filter((c) => idPeserta.has(c.jamaah_id)), namaKelompok);
        if (lalu.total.persen !== null && total.persen !== null) {
          const d = total.persen - lalu.total.persen;
          catatanOtomatis.push(
            d === 0
              ? `Sama dengan ${namaBulan(bulanSebelum(p.bulan))} (${lalu.total.persen}%).`
              : `${d > 0 ? "Naik" : "Turun"} ${Math.abs(d)} poin dibanding ${namaBulan(bulanSebelum(p.bulan))} (${lalu.total.persen}%).${d > 0 ? " Alhamdulillah." : ""}`,
          );
        }
      }
      const urut = kolom.filter((k) => k.peserta > 0).map((k) => ({ ...k, p: persen(k.hadir, k.peserta) ?? 0 }));
      if (urut.length > 1) {
        const ramai = urut.reduce((a, b) => (b.p > a.p ? b : a));
        const sepi = urut.reduce((a, b) => (b.p < a.p ? b : a));
        catatanOtomatis.push(
          `Paling ramai: ${ramai.nama} (${tanggal(ramai.mulai)}, ${ramai.p}%). Paling sepi: ${sepi.nama} (${tanggal(sepi.mulai)}, ${sepi.p}%).`,
        );
      }
      const penuh = baris.filter((b) => b.peserta >= 2 && b.hadir === b.peserta).map((b) => b.nama);
      if (penuh.length) {
        catatanOtomatis.push(`MasyaAllah, hadir di semua pertemuan (${penuh.length} orang): ${daftarNama(penuh)}.`);
      }
    }
    // Perlu disapa: tidak hadir (tanpa izin/sakit) di 3 pertemuan terakhir yang diikutinya.
    if (kolom.length >= 3) {
      const sapa = baris
        .filter((b) => {
          const ikut = kolom.map((k) => b.sel[k.id]).filter((s) => s !== "-");
          return ikut.length >= 3 && ikut.slice(-3).every((s) => s === "A");
        })
        .map((b) => b.nama);
      if (sapa.length) {
        catatanOtomatis.push(`Perlu disapa (tidak hadir 3 pertemuan terakhir berturut-turut): ${daftarNama(sapa, 8)}.`);
      }
    }
    if (total.hadir > 0) catatanOtomatis.push(`${ucapanSyukur()} atas kehadiran para jamaah.`);
  }

  return { param: p, judul, keterangan, kolom, baris, total, catatan: catatanOtomatis, namaFile };
}
